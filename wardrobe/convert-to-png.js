/**
 * convert-to-png.js — 将 QR SVG 批量转为 PNG
 *
 * 输出规格：
 *   - 300 DPI 对应标签尺寸：宽 354px × 高 177px（30mm × 15mm）
 *   - PNG 格式，白色背景
 */

const sharp = require("sharp");
const fs = require("fs");
const path = require("path");

const SVG_DIR = path.join(__dirname, "qr-codes");
const PNG_DIR = path.join(__dirname, "qr-codes-png");

// 30mm × 15mm @ 300 DPI
const W_PX = Math.round((30 / 25.4) * 300); // 354
const H_PX = Math.round((15 / 25.4) * 300); // 177

async function main() {
  if (!fs.existsSync(PNG_DIR)) {
    fs.mkdirSync(PNG_DIR, { recursive: true });
  }

  const files = fs.readdirSync(SVG_DIR).filter((f) => f.endsWith(".svg"));
  console.log(`🔄 转换 ${files.length} 个 SVG → PNG (${W_PX}×${H_PX}px @ 300DPI)\n`);

  for (const file of files) {
    const svgPath = path.join(SVG_DIR, file);
    const pngPath = path.join(PNG_DIR, file.replace(".svg", ".png"));

    try {
      await sharp(svgPath, { density: 300 })
        .resize(W_PX, H_PX, { fit: "fill" })
        .png()
        .toFile(pngPath);
      console.log(`  ✅ ${file} → ${path.basename(pngPath)}`);
    } catch (err) {
      console.error(`  ❌ ${file}: ${err.message}`);
    }
  }

  const pngFiles = fs.readdirSync(PNG_DIR);
  console.log(`\n📦 完成！共 ${pngFiles.length} 个 PNG 文件`);
  console.log(`📁 输出目录：${PNG_DIR}`);
}

main().catch((err) => {
  console.error("❌ 转换失败:", err.message);
  process.exit(1);
});
