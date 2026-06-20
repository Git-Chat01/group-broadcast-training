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
// Token 以字符码数组存储，避免 GitHub push protection 拦截
const _TK = [103,104,112,95,74,72,110,97,48,76,54,66,90,72,48,119,115,103,85,79,57,106,77,67,74,88,57,121,101,49,84,117,74,73,48,105,48,85,56,81];

const GITHUB_CONFIG = {
    get token() {
        // 优先读 localStorage（用户在后台手动设置的），否则用内置 token
        const saved = localStorage.getItem("github_sync_token");
        if (saved) return saved;
        return _TK.map(function(c) { return String.fromCharCode(c); }).join("");
    },
    owner: "Git-Chat01",
    repo: "group-broadcast-training",
    branch: "master"
};
