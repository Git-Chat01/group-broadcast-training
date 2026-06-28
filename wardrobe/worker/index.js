/**
 * Cloudflare Worker — 服装库飞书 API 代理 + 培训系统数据同步
 *
 * 路由：
 *   /image/{file_token}  — 飞书附件代理（下载图片）
 *   /api/sync             — 培训系统 GitHub db.json 读写代理
 *   /api/*                — 飞书 API 代理（旧服装库接口）
 *
 * 部署：wrangler deploy
 */

// ===== 飞书 Token 缓存 =====
let cachedToken = null;
let tokenExpiry = 0;

async function getTenantToken(env) {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const resp = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: env.FEISHU_APP_ID,
        app_secret: env.FEISHU_APP_SECRET,
      }),
    }
  );

  const data = await resp.json();
  if (data.code === 0) {
    cachedToken = data.tenant_access_token;
    tokenExpiry = Date.now() + (data.expire - 60) * 1000;
    return cachedToken;
  }

  throw new Error("获取飞书 token 失败: " + JSON.stringify(data));
}

// ===== GitHub 数据同步 =====
const SYNC_OWNER = "Git-Chat01";
const SYNC_REPO = "group-broadcast-training";
const SYNC_BRANCH = "master";
const SYNC_FILE = "db.json";

// ===== 乱码检测与修复工具（服务端防线） =====

/**
 * 判断字符串是否看起来像乱码（UTF-8 双重编码导致）
 * 特征：不含中日韩字符 + 含有大量 Latin-1 补充字符（0x80-0xFF）
 */
function looksGarbled(str) {
  if (!str || typeof str !== "string") return false;
  // 如果包含 CJK 字符，说明已经是正确的中文，不是乱码
  if (/[一-鿿]/.test(str)) return false;
  let latin1Count = 0;
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i);
    if (c >= 0x80 && c <= 0xff) latin1Count++;
  }
  // 至少 2 个 Latin-1 补充字符，或者字符串异常长（可能是编码膨胀）
  return latin1Count >= 2 || (latin1Count >= 1 && str.length > 20);
}

/**
 * 尝试修复乱码字符串
 * 原理：将乱码字符串按 Latin-1 解释为字节，再用 UTF-8 解码
 * 如果修复失败则返回 null
 */
function tryFixGarbled(str) {
  try {
    // 将每个字符的 charCode（如果是 Latin-1 范围）当作字节
    const bytes = new Uint8Array(str.length);
    for (let i = 0; i < str.length; i++) {
      bytes[i] = str.charCodeAt(i) & 0xff;
    }
    const fixed = new TextDecoder("utf-8").decode(bytes);
    // 修复后必须包含 CJK 字符才算成功
    if (/[一-鿿]/.test(fixed) && fixed !== str) {
      return fixed;
    }
  } catch (e) {
    // 解码失败，返回 null
  }
  return null;
}

/**
 * 递归清理对象中所有的乱码字符串值
 * 遍历所有属性，对每个字符串值调用 looksGarbled → tryFixGarbled
 * 注意：只处理值，不处理键名（键名由上层 cleanTrainees 处理）
 */
function deepCleanValues(obj, log, path) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === "string") {
    if (looksGarbled(obj)) {
      const fixed = tryFixGarbled(obj);
      if (fixed) {
        const preview = obj.length > 30 ? obj.slice(0, 30) + "..." : obj;
        log.push(`[修复] ${path}: "${preview}" → 已修复`);
        return fixed;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    const result = [];
    for (let i = 0; i < obj.length; i++) {
      result.push(deepCleanValues(obj[i], log, path + "[" + i + "]"));
    }
    return result;
  }
  if (typeof obj === "object") {
    const cleaned = {};
    for (const [k, v] of Object.entries(obj)) {
      cleaned[k] = deepCleanValues(v, log, path ? path + "." + k : k);
    }
    return cleaned;
  }
  return obj;
}

/**
 * 清理 trainees 对象中的乱码键名和深层乱码值
 * 这是服务端最后一道防线，阻断任何客户端产生的乱码数据写入 GitHub
 */
function cleanTrainees(trainees) {
  if (!trainees || typeof trainees !== "object") return { cleaned: trainees, log: [] };
  const cleaned = {};
  const log = [];

  for (const [name, entryData] of Object.entries(trainees)) {
    let fixedName = name;
    let data = entryData;

    // 1. 检测键名是否乱码
    if (looksGarbled(name)) {
      const fixed = tryFixGarbled(name);
      if (fixed) {
        log.push(`[修复] 键名乱码: "${name}" → "${fixed}"`);
        fixedName = fixed;
      } else {
        log.push(`[丢弃] 键名乱码无法修复: "${name}"`);
        continue;
      }
    }

    // 2. 深度清理 trainee 数据中的所有乱码字符串值
    data = deepCleanValues(data, log, fixedName);

    // 3. 如果修复后的键名已存在，合并数据
    if (cleaned[fixedName]) {
      log.push(`[合并] 键名冲突: "${fixedName}"，保留已有数据`);
      cleaned[fixedName] = { ...data, ...cleaned[fixedName] };
    } else {
      cleaned[fixedName] = data;
    }
  }

  return { cleaned, log };
}

/**
 * 处理 /api/sync 请求
 * GET  — 拉取 GitHub db.json → base64 解码 → 返回 JSON
 * POST — 接收 JSON → base64 编码 → 写入 GitHub db.json
 */
async function handleSync(request, env) {
  const token = env.GITHUB_TOKEN;
  if (!token) {
    return new Response(
      JSON.stringify({ error: true, message: "Worker 未配置 GITHUB_TOKEN" }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const apiBase = `https://api.github.com/repos/${SYNC_OWNER}/${SYNC_REPO}/contents/${SYNC_FILE}?ref=${SYNC_BRANCH}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "cide-sync-worker",
  };

  // —— GET：拉取 db.json ——
  if (request.method === "GET") {
    try {
      // 1. 从 Contents API 获取元数据（SHA + 可能包含 content）
      const resp = await fetch(apiBase, { headers });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        return new Response(
          JSON.stringify({
            error: true,
            status: resp.status,
            message: err.message || "GitHub API 请求失败",
            exists: resp.status !== 404,
          }),
          {
            status: resp.status === 404 ? 404 : 502,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      const file = await resp.json();

      // 2. 获取文件内容 — 小文件直接用 content 字段，大文件（>1MB）走 Git Blobs API
      let decoded;
      if (file.content) {
        // 小文件：content 字段已包含 base64 内容
        const raw = atob(file.content.replace(/\s/g, ""));
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
        decoded = new TextDecoder("utf-8").decode(bytes);
      } else {
        // 大文件（>1MB）：Contents API 不含 content，用 git_url 获取 blob
        const blobResp = await fetch(file.git_url, { headers });
        if (!blobResp.ok) {
          throw new Error("获取大文件 blob 失败: HTTP " + blobResp.status);
        }
        const blob = await blobResp.json();
        const raw = atob(blob.content.replace(/\s/g, ""));
        const bytes = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
        decoded = new TextDecoder("utf-8").decode(bytes);
      }

      // 3. 解析 JSON 并清理可能残存的乱码数据
      const content = JSON.parse(decoded);
      if (content.trainees) {
        const { cleaned, log } = cleanTrainees(content.trainees);
        if (log.length > 0) {
          console.log("[sync] GET trainees 清理记录:", JSON.stringify(log));
        }
        content.trainees = cleaned;
      }

      return new Response(
        JSON.stringify({
          sha: file.sha,
          content,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: true, message: err.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }

  // —— POST：推送 db.json ——
  if (request.method === "POST") {
    try {
      const body = await request.json();
      if (!body.content) {
        return new Response(
          JSON.stringify({ error: true, message: "缺少 content 字段" }),
          {
            status: 400,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      // ===== 服务端乱码防御：清理 trainees 中的乱码数据 =====
      let cleanLog = [];
      if (body.content.trainees) {
        const { cleaned, log } = cleanTrainees(body.content.trainees);
        cleanLog = log;
        if (log.length > 0) {
          console.log("[sync] POST trainees 清理记录:", JSON.stringify(log));
        }
        body.content.trainees = cleaned;
      }

      // ===== 数据保护锁：防止意外清空学员数据 =====
      // 当 incoming trainees 为空时，先拉取 GitHub 当前数据比对，
      // 如果远端有学员但 incoming 是空的，拒绝写入，防止 bug 客户端/错误操作清空数据
      const incomingTraineeCount = Object.keys(body.content.trainees || {}).length;
      if (incomingTraineeCount === 0) {
        try {
          const checkResp = await fetch(apiBase, { headers });
          if (checkResp.ok) {
            const currentFile = await checkResp.json();
            if (currentFile.content) {
              const raw = atob(currentFile.content.replace(/\s/g, ""));
              const bytes = new Uint8Array(raw.length);
              for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i) & 0xff;
              const current = JSON.parse(new TextDecoder("utf-8").decode(bytes));
              const currentTraineeCount = Object.keys(current.trainees || {}).length;
              if (currentTraineeCount > 0) {
                console.warn("[sync] ⛔ 拦截：尝试将 " + currentTraineeCount + " 名学员数据清空，拒绝写入");
                return new Response(
                  JSON.stringify({
                    error: true,
                    message: "数据保护：远端有 " + currentTraineeCount + " 名学员数据，拒绝清空。" +
                             "如果你确实要清除所有学员数据，请先手动删除后再同步。",
                    protected: true,
                    currentTraineeCount,
                  }),
                  {
                    status: 409,
                    headers: {
                      "Content-Type": "application/json; charset=utf-8",
                      "Access-Control-Allow-Origin": "*",
                    },
                  }
                );
              }
            }
          }
        } catch (e) {
          // 检查失败不影响正常写入流程，仅记录日志
          console.warn("[sync] 数据保护检查失败，跳过:", e.message);
        }
      }

      // 序列化前删除临时字段（防止 _cleanLog 写入 db.json）
      delete body.content._cleanLog;

      // 将 JSON 内容序列化后 base64 编码
      const jsonStr = JSON.stringify(body.content, null, 2);
      const encoded = btoa(unescape(encodeURIComponent(jsonStr)));

      const putBody = {
        message: "数据同步 " + new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }),
        content: encoded,
        branch: SYNC_BRANCH,
      };
      if (body.sha) {
        putBody.sha = body.sha;
      }

      const resp = await fetch(apiBase, {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(putBody),
      });

      const result = await resp.json();

      if (!resp.ok) {
        return new Response(
          JSON.stringify({
            error: true,
            status: resp.status,
            message: result.message || "GitHub API 写入失败",
            conflict: resp.status === 409,
          }),
          {
            status: resp.status,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }

      return new Response(
        JSON.stringify({
          ok: true,
          sha: result.content ? result.content.sha : null,
          cleanLog: cleanLog.length > 0 ? cleanLog : undefined,
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: true, message: err.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  }

  // 其他方法
  return new Response(
    JSON.stringify({ error: true, message: "不支持的请求方法" }),
    {
      status: 405,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

// ===== 主入口 =====
export default {
  async fetch(request, env) {
    // CORS 预检
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // ===== 图片代理：/image/{file_token} =====
    if (path.startsWith("/image/")) {
      const fileToken = path.replace("/image/", "");
      if (!fileToken) {
        return new Response("Missing file_token", { status: 400 });
      }

      try {
        const token = await getTenantToken(env);
        const resp = await fetch(
          `https://open.feishu.cn/open-apis/drive/v1/medias/${fileToken}/download`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );

        if (!resp.ok) {
          return new Response("Image not found", { status: resp.status });
        }

        const imageData = await resp.arrayBuffer();
        const contentType = resp.headers.get("Content-Type") || "image/jpeg";

        return new Response(imageData, {
          status: 200,
          headers: {
            "Content-Type": contentType,
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=86400",
          },
        });
      } catch (err) {
        return new Response(
          JSON.stringify({ error: true, message: err.message }),
          {
            status: 500,
            headers: {
              "Content-Type": "application/json; charset=utf-8",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // ===== 数据同步：/api/sync（必须在 /api/ 代理之前拦截） =====
    if (path === "/api/sync" || path === "/api/sync/") {
      return handleSync(request, env);
    }

    // ===== 飞书 API 代理：/api/* =====
    if (!path.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    const feishuPath = path.replace("/api", "");
    const feishuUrl = `https://open.feishu.cn${feishuPath}${url.search}`;

    try {
      const token = await getTenantToken(env);

      const body = request.method !== "GET" ? await request.text() : undefined;

      const resp = await fetch(feishuUrl, {
        method: request.method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body || undefined,
      });

      const data = await resp.json();

      return new Response(JSON.stringify(data), {
        status: resp.status,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: true, message: err.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json; charset=utf-8",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
