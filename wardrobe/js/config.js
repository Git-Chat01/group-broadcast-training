/**
 * config.js — 服装库前端配置
 *
 * 部署步骤：
 * 1. 部署 Cloudflare Worker 后会得到一个 URL
 * 2. 把 WORKER_URL 改成你的 Worker 地址
 */

// Cloudflare Worker 地址（部署后替换）
// 2026-06-24: workers.dev 国内被屏蔽，改用自定义域名
// 用 var + 条件声明，兼容 HTML 内联预定义
var WORKER_URL = typeof WORKER_URL !== 'undefined' ? WORKER_URL : "https://api.aivar.cc";

// 飞书多维表格标识
var BASE_TOKEN = typeof BASE_TOKEN !== 'undefined' ? BASE_TOKEN : "HwTEbujlFa4JFWskg7LcicTgnJd";
var TABLE_ID = typeof TABLE_ID !== 'undefined' ? TABLE_ID : "tblpZvj6zpznu1h2";

// 管理员密码（与培训系统一致）
var ADMIN_PASSWORD = typeof ADMIN_PASSWORD !== 'undefined' ? ADMIN_PASSWORD : "xsx2001..";

// 缓存用的 key
var STORAGE_KEY_BORROWER = typeof STORAGE_KEY_BORROWER !== 'undefined' ? STORAGE_KEY_BORROWER : "wardrobe_last_borrower";
