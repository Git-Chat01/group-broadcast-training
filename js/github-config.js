/* ============================================
   github-config.js — 云端同步配置
   2026-08-15 安全改造：数据存储从 GitHub 公开仓库 db.json
   迁移到 Cloudflare KV（Worker 端），前端经 /api/sync 读写，
   所有请求携带 X-Sync-Key 鉴权头。
   ============================================ */

const GITHUB_CONFIG = {
    // 同步 Worker 地址 — 数据存 Worker 端 KV，不再经过 GitHub 仓库
    syncWorker: "https://api.aivar.cc",

    // 同步鉴权 key（与 Worker 端 SYNC_SECRET 一致）。
    // 注意：前端是公开静态站点，此 key 对能看到源码的人可见，
    // 作用是阻止匿名爬虫/路人直接拉取同步数据，非高强度认证。
    syncKey: "c7b4f5b566c9e7ae6a048b787e2a0639a807f212a611ef2d",

    // 以下字段供向后兼容，不再直接调 GitHub API
    get token() {
        return localStorage.getItem("github_sync_token") || null;
    },
    owner: "Git-Chat01",
    repo: "group-broadcast-training",
    branch: "master"
};
