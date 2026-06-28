/* ============================================
   github-config.js — GitHub API 云端同步配置
   使用 GitHub Contents API 读写仓库中的 db.json
   token 存储在浏览器 localStorage 中，不提交到代码仓库
   ============================================ */

/**
 * 🔧 使用步骤：
 * 1. 打开 https://github.com/settings/tokens
 * 2. 点击 "Generate new token" → "Generate new token (classic)"
 * 3. Note 填 "cide-sync"，Expiration 选 "No expiration"
 * 4. 勾选 "repo" 权限（全勾）
 * 5. 生成后复制 token
 * 6. 在培训师后台「内容管理」页面底部「同步设置」中粘贴并保存
 */
const GITHUB_CONFIG = {
    // 同步 Worker 地址 — 所有 GitHub API 调用经此代理，Token 存在 Worker 端不暴露
    syncWorker: "https://api.aivar.cc",

    // 以下字段供向后兼容，不再直接调 GitHub API
    get token() {
        return localStorage.getItem("github_sync_token") || null;
    },
    owner: "Git-Chat01",
    repo: "group-broadcast-training",
    branch: "master"
};
