/**
 * config.js — 服装库前端配置
 *
 * 部署步骤：
 * 1. 部署 Cloudflare Worker 后会得到一个 URL
 * 2. 把 WORKER_URL 改成你的 Worker 地址
 */

// Cloudflare Worker 地址（部署后替换）
// 2026-06-24: workers.dev 国内被屏蔽，改用自定义域名
const WORKER_URL = "https://api.aivar.cc";

// 飞书多维表格标识
const BASE_TOKEN = "HwTEbujlFa4JFWskg7LcicTgnJd";
const TABLE_ID = "tblpZvj6zpznu1h2";

// 管理员密码（与培训系统一致）
const ADMIN_PASSWORD = "xsx2001..";

// 缓存用的 key
const STORAGE_KEY_BORROWER = "wardrobe_last_borrower";
