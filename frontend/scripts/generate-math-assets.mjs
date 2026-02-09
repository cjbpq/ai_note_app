import fs from "fs";
import path from "path";

/**
 * 生成 constants/mathAssets.ts
 *
 * 目标：
 * - 彻底移除 KaTeX 字体的 CDN 引用
 * - 将 katex.min.css 中的字体（woff2）内联为 base64 data URL
 * - 同时内联 katex.min.js 与 auto-render.min.js（离线可用）
 *
 * 为什么做成脚本：
 * - 版本升级时可重复生成（不需要手动复制/粘贴巨量字符串）
 * - 避免 assets/fonts 产生大量未追踪文件
 */

const projectRoot = process.cwd();
const katexRoot = path.join(projectRoot, "node_modules", "katex");
const katexDist = path.join(katexRoot, "dist");
const fontsDir = path.join(katexDist, "fonts");

const outFile = path.join(projectRoot, "constants", "mathAssets.ts");

const readText = (filePath) => fs.readFileSync(filePath, "utf8");
const readBase64 = (filePath) => fs.readFileSync(filePath).toString("base64");

const main = () => {
  // 1) 读取版本号（方便排查线上与本地差异）
  const katexPkg = JSON.parse(readText(path.join(katexRoot, "package.json")));
  const katexVersion = katexPkg?.version ?? "unknown";

  // 2) 读取 CSS/JS
  const cssPath = path.join(katexDist, "katex.min.css");
  const katexJsPath = path.join(katexDist, "katex.min.js");
  const autoRenderPath = path.join(katexDist, "contrib", "auto-render.min.js");

  let css = readText(cssPath);
  const katexJs = readText(katexJsPath);
  const autoRenderJs = readText(autoRenderPath);

  // 3) 建立字体 base64 映射（只用 woff2，体积更小且 WebView 兼容性足够）
  const fontFiles = fs
    .readdirSync(fontsDir)
    .filter((name) => name.toLowerCase().endsWith(".woff2"));

  const fontBase64Map = new Map();
  for (const fileName of fontFiles) {
    const fullPath = path.join(fontsDir, fileName);
    fontBase64Map.set(fileName, readBase64(fullPath));
  }

  // 4) 将 CSS 中所有 woff2 url(...) 替换成 data URL
  // katex.min.css 的字体通常是 url(fonts/KaTeX_*.woff2)
  css = css.replace(/url\(([^)]+?\.woff2)\)/g, (match, rawUrl) => {
    const cleaned = String(rawUrl).replace(/^['"]|['"]$/g, "");
    const baseName = path.basename(cleaned);
    const b64 = fontBase64Map.get(baseName);

    if (!b64) {
      throw new Error(
        `Font file not found for CSS url: ${cleaned} (basename: ${baseName})`,
      );
    }

    return `url(data:font/woff2;base64,${b64})`;
  });

  // 5) 去掉 woff/ttf fallback（只保留 woff2）
  css = css
    .replace(/,url\([^)]+?\.woff\) format\(["']woff["']\)/g, "")
    .replace(/,url\([^)]+?\.ttf\) format\(["']truetype["']\)/g, "");

  // 6) 输出 TS 文件（用 JSON.stringify，避免模板字符串被反引号打断）
  const now = new Date();
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  const banner = `// ============================================================================\n// KaTeX 本地化资源 (Auto-generated)\n// 生成日期: ${date}\n// 来源: node_modules/katex@${katexVersion}/dist\n// 说明: katex.min.css 的字体(woff2)已内联为 base64 data URL，实现完全离线渲染\n// 注意: 请勿手动编辑此文件。如需升级 KaTeX 版本，重新运行 scripts/generate-math-assets.mjs\n// ============================================================================\n\n`;

  const output =
    banner +
    `export const KATEX_CSS = ${JSON.stringify(css)};\n\n` +
    `export const KATEX_JS = ${JSON.stringify(katexJs)};\n\n` +
    `export const AUTO_RENDER_JS = ${JSON.stringify(autoRenderJs)};\n`;

  fs.writeFileSync(outFile, output, "utf8");

  // 7) 简单自检（避免生成了仍含 CDN 的 CSS）
  if (/https?:\/\//.test(css) || /cdn\.jsdelivr\.net/.test(css)) {
    throw new Error(
      "Generated KATEX_CSS still contains http(s) urls. Check replacement logic.",
    );
  }

  console.log(
    `[generate-math-assets] Done. Wrote: ${path.relative(projectRoot, outFile)}`,
  );
};

main();
