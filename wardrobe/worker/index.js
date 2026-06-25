/**
 * Cloudflare Worker — 服装库飞书 API 代理
 *
 * 作用：前端静态页面通过这个 Worker 间接访问飞书多维表格
 * 为什么需要：GitHub Pages 是纯静态的，不能直接调飞书 API（CORS + token 安全）
 *
 * 部署后你会得到一个 URL，比如 https://wardrobe-api.xxx.workers.dev
 * 前端 js/config.js 里配这个地址即可
 */

// 缓存 tenant_access_token，避免每次请求都去飞书鉴权
let cachedToken = null;
let tokenExpiry = 0;

/**
 * 获取 tenant_access_token（自动缓存复用）
 */
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
    // 提前 60 秒过期，留足余量
    tokenExpiry = Date.now() + (data.expire - 60) * 1000;
    return cachedToken;
  }

  throw new Error("获取飞书 token 失败: " + JSON.stringify(data));
}

export default {
  async fetch(request, env) {
    // CORS 预检请求 — 直接放行
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

    // 图片代理：飞书附件 tmp_url 有短时效，用 file_token 通过 Worker 代理下载
    // URL 格式：/image/{file_token}
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
              "Content-Type": "application/json",
              "Access-Control-Allow-Origin": "*",
            },
          }
        );
      }
    }

    // 只代理 /api/ 路径，防止被滥用
    if (!path.startsWith("/api/")) {
      return new Response("Not Found", { status: 404 });
    }

    // 去掉 /api 前缀，拼出真实的飞书 API 地址
    const feishuPath = path.replace("/api", "");
    const feishuUrl = `https://open.feishu.cn${feishuPath}${url.search}`;

    try {
      const token = await getTenantToken(env);

      // 转发请求到飞书
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
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      });
    } catch (err) {
      return new Response(
        JSON.stringify({ error: true, message: err.message }),
        {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
  },
};
