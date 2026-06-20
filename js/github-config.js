/* ============================================
   github-config.js — GitHub API 云端同步配置
   使用 GitHub Contents API 读写仓库中的 db.json
   ============================================ */

/**
 * 🔧 使用步骤：
 * 1. 打开 https://github.com/settings/tokens
 * 2. 点击 "Generate new token" → "Generate new token (classic)"
 * 3. Note 填 "cide-sync"，Expiration 选 "No expiration"
 * 4. 勾选 "repo" 权限（全勾）
 * 5. 点 "Generate token"，复制生成的 token（ghp_开头）
 * 6. 将 token 粘贴到下面的 GITHUB_CONFIG.token 中
 */
const GITHUB_CONFIG = {
    token: "ghp_YOUR_TOKEN_HERE",
    owner: "Git-Chat01",
    repo: "group-broadcast-training",
    branch: "master"
};
