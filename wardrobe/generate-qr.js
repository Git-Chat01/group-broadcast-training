/**
 * generate-qr.js — 服装库 QR 码生成脚本（修复版）
 *
 * Bug 修复：上一版把所有 path 强制 fill="#000"，导致 QR 白底变黑底，
 * 整个码全黑无法扫描。这个版本保留原始 path 的 fill/stroke 颜色属性。
 *
 * 输出规格：
 *   - 86 个单品码（T001-T086）+ 1 个通用归还码
 *   - 每个 SVG 尺寸：宽 30mm × 高 15mm（3cm × 1.5cm）
 *   - 布局：左侧二维码（~13mm）+ 右侧编号标注
 *   - 错误纠正等级 M，适合打印标签
 *
 * 用法：node generate-qr.js
 * 输出：./qr-codes/ 目录下所有 SVG 文件
 */

const QRCode = require("qrcode");
const fs = require("fs");
const path = require("path");

// ======================== 配置 ========================

const OUTPUT_DIR = path.join(__dirname, "qr-codes");
const BASE_URL = "https://wardrobe.aivar.cc/item.html";

// 标签总尺寸（mm）
const LABEL_W_MM = 30;
const LABEL_H_MM = 15;

// QR 码区域（正方形，左侧居中）
const QR_SIZE_MM = 13;
const QR_X_MM = 1; // 左边距 1mm
const QR_Y_MM = (LABEL_H_MM - QR_SIZE_MM) / 2; // 垂直居中

// 文字区域（右侧）
const TEXT_X_MM = QR_X_MM + QR_SIZE_MM + 1.5; // QR 右边留 1.5mm 间距
const TEXT_Y_MM = LABEL_H_MM / 2;

// ======================== 函数 ========================

/**
 * 生成 QR 码的 SVG path 数据
 *
 * qrcode 库原始 SVG 包含两条 path：
 *   1. <path fill="#ffffff" d="M0 0h33v33H0z"/>  — 白色背景块
 *   2. <path stroke="#000000" d="M0 0.5h7..."/>    — 黑色 QR 模块（用 stroke 画水平线）
 *
 * 注意：第一条 fill 是背景色（#fff），第二条 stroke 是模块色（#000）。
 * 必须保留各自的颜色，不能全部覆盖成同一种颜色。
 */
async function generateQrPaths(url) {
  const svgStr = await QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 0,
    color: { dark: "#000", light: "#fff" },
  });

  // 提取每条 <path> 的完整属性，保留 d / fill / stroke
  const pathRegex = /<path\s+([^>]*)\/>/g;
  const pathAttrs = [];
  let match;
  while ((match = pathRegex.exec(svgStr)) !== null) {
    const attrStr = match[1];
    const dMatch = attrStr.match(/d="([^"]*)"/);
    const fillMatch = attrStr.match(/fill="([^"]*)"/);
    const strokeMatch = attrStr.match(/stroke="([^"]*)"/);
    if (dMatch) {
      pathAttrs.push({
        d: dMatch[1],
        fill: fillMatch ? fillMatch[1] : null,
        stroke: strokeMatch ? strokeMatch[1] : null,
      });
    }
  }

  // 提取 viewBox
  const vbMatch = svgStr.match(/viewBox="([^"]*)"/);
  const viewBox = vbMatch ? vbMatch[1] : "0 0 25 25";

  return { pathAttrs, viewBox };
}

/**
 * 根据保留的属性重建每个 <path> 元素的字符串
 * @returns {string} 如 fill="#ffffff" stroke="#000000"
 */
function buildAttrString(attrs) {
  const parts = [];
  // fill 属性（背景路径用）
  if (attrs.fill) {
    parts.push(`fill="${attrs.fill}"`);
  }
  // stroke 属性（模块路径用 — 关键！用描边画 QR 模块线）
  if (attrs.stroke) {
    parts.push(`stroke="${attrs.stroke}"`);
  }
  // 如果都没匹配到，fallback 用黑色填充
  if (parts.length === 0) {
    parts.push(`fill="#000000"`);
  }
  return parts.join(" ");
}

/**
 * 生成单个标签的 SVG 文件
 *
 * @param {string} itemId — 服装编号，如 "T001"
 * @param {string} url   — QR 码编码的 URL
 * @param {string} label — 标签上显示的文字
 */
async function generateLabel(itemId, url, label) {
  const { pathAttrs, viewBox } = await generateQrPaths(url);

  // 用 viewBox 信息计算缩放比例
  const vbParts = viewBox.split(/\s+/);
  const vbW = parseFloat(vbParts[2]);
  const vbH = parseFloat(vbParts[3]);

  const scaleX = QR_SIZE_MM / vbW;
  const scaleY = QR_SIZE_MM / vbH;

  // 重构 path 元素，保留原始颜色属性
  const pathElements = pathAttrs
    .map(
      (pa) =>
        `    <path d="${pa.d}" transform="translate(${QR_X_MM},${QR_Y_MM}) scale(${scaleX},${scaleY})" ${buildAttrString(pa)}/>`
    )
    .join("\n");

  // 文字大小
  const isReturn = itemId === "RETURN";
  const fontSize = isReturn ? 4 : 3.8;
  const textContent = isReturn ? "归还" : itemId;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${LABEL_W_MM}mm" height="${LABEL_H_MM}mm"
     viewBox="0 0 ${LABEL_W_MM} ${LABEL_H_MM}">
  <!-- 白色背景（标签底色） -->
  <rect width="${LABEL_W_MM}" height="${LABEL_H_MM}" fill="#ffffff"/>
  <!-- QR 码 -->
${pathElements}
  <!-- 编号标注 -->
  <text x="${TEXT_X_MM}" y="${TEXT_Y_MM}"
        font-family="Arial, Helvetica, sans-serif"
        font-size="${fontSize}mm"
        font-weight="bold"
        fill="#000000"
        text-anchor="start"
        dominant-baseline="central">${textContent}</text>
</svg>`;

  const filename = `${itemId}.svg`;
  fs.writeFileSync(path.join(OUTPUT_DIR, filename), svg, "utf-8");
  console.log(`  ✅ ${filename}`);
}

// ======================== 主流程 ========================

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log("🏷️  开始生成 QR 码标签（修复版：保留原始颜色属性）...\n");

  // ---- 单品码：T001 ~ T086 ----
  for (let i = 1; i <= 86; i++) {
    const id = `T${String(i).padStart(3, "0")}`;
    const url = `${BASE_URL}?id=${id}`;
    await generateLabel(id, url, id);
  }

  // ---- 通用归还码 ----
  const returnUrl = `${BASE_URL}?id=RETURN`;
  await generateLabel("RETURN", returnUrl, "归还");

  // ---- 统计 ----
  const files = fs.readdirSync(OUTPUT_DIR);
  console.log(`\n📦 完成！共生成 ${files.length} 个标签文件`);
  console.log(`📁 输出目录：${OUTPUT_DIR}`);
}

main().catch((err) => {
  console.error("❌ 生成失败:", err.message);
  process.exit(1);
});
