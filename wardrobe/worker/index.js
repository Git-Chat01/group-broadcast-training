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

      return new Response(
        JSON.stringify({
          sha: file.sha,
          content: JSON.parse(decoded),
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
