/* ============================================
   sw.js — Service Worker 离线缓存 + 更新提示
   缓存策略：
   - CSS/JS（带 ?v= 版本号）→ Cache First（URL变更即自动刷新）
   - HTML → Network First（始终获取最新页面结构）
   - 图片/字体 → Cache First（长期不变）

   ⚠️ 部署新版时：CACHE_NAME 必须与 index.html 的 ?v= 保持同步。
   详见 js/data.js 顶部注释中的三处版本号说明。
   ============================================ */

const CACHE_NAME = "cide-v69";
const CACHE_ASSETS = [
  "/",
  "/index.html",
  "/css/common.css?v=69",
  "/css/trainee.css?v=69",
  "/css/trainer.css?v=69",
  "/js/github-config.js?v=69",
  "/js/storage.js?v=69",
  "/js/data.js?v=69",
  "/js/exams_data.js?v=69",
  "/js/auth.js?v=69",
  "/js/cognition.js?v=69",
  "/js/trainee.js?v=69",
  "/js/import.js?v=69",
  "/js/trainer.js?v=69",
  "/js/app.js?v=69",
];

// ===== Install：预缓存核心资源 =====
self.addEventListener("install", (event) => {
  console.log("[SW] 安装中…");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[SW] 缓存核心资源");
      return cache.addAll(CACHE_ASSETS).catch((err) => {
        // 部分资源可能因网络问题缓存失败，不阻塞安装
        console.warn("[SW] 部分资源缓存失败:", err);
      });
    })
  );
  // 立即激活，不等待旧 SW 释放
  self.skipWaiting();
});

// ===== Activate：清理旧版本缓存 =====
self.addEventListener("activate", (event) => {
  console.log("[SW] 激活");
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => {
          console.log("[SW] 清理旧缓存:", key);
          return caches.delete(key);
        })
      );
    })
  );
  // 立即接管所有页面
  self.clients.claim();
});

// ===== Fetch：智能缓存策略 =====
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 跳过非 GET 请求和 Chrome 扩展请求
  if (request.method !== "GET") return;
  if (!url.protocol.startsWith("http")) return;

  // 跳过 GitHub API 请求（数据同步不走缓存）
  if (url.hostname === "api.github.com") return;

  // 策略 1：HTML 文档 → Network First
  if (request.mode === "navigate" || request.destination === "document") {
    event.respondWith(networkFirst(request));
    return;
  }

  // 策略 2：CSS / JS / 图片 / 字体 → Cache First
  if (
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font"
  ) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // 默认：Network First
  event.respondWith(networkFirst(request));
});

// ===== 缓存策略函数 =====

/** Cache First：优先用缓存，缓存未命中才走网络（并缓存结果） */
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 离线且无缓存：返回空响应（避免页面崩溃）
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

/** Network First：优先用网络，失败时回退到缓存 */
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // 完全离线且无缓存：返回离线页面
    if (request.mode === "navigate") {
      const offlineCache = await caches.match("/");
      if (offlineCache) return offlineCache;
    }
    return new Response("", { status: 503, statusText: "Offline" });
  }
}

// ===== 更新通知：收到 message 时告知客户端有新版本 =====
self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }
});
