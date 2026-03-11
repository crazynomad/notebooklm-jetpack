// Generate 1280x800 store screenshots from template (Chinese + English)
// Each slide: full screenshot as dimmed base + highlight crop as foreground.
// Usage: node docs/screenshots/generate.mjs

import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const slides = [
  {
    id: '01-bookmarks',
    num: '01',
    pill: 'Bookmarks',
    title: '20 篇文章，只占 1 个来源配额',
    subtitle: '收藏 → 聚合 → 导出 PDF → 突破 50 来源限制',
    title_en: '20 Articles, Just 1 Source Slot',
    subtitle_en: 'Bookmark → Merge → Export PDF → Break the 50-source limit',
    img: 'raw/01-bookmarks.png',
    highlightImg: 'raw/01-bookmarks-highlight.png',
    accent: '#c4553a',
    accentRgb: '196, 85, 58',
  },
  {
    id: '02-docs',
    num: '02',
    pill: 'Doc Sites',
    title: '整个文档站，一键导入',
    subtitle: '自动识别 14+ 框架，提取全站页面树',
    title_en: 'Import Entire Doc Sites',
    subtitle_en: 'Auto-detect 14+ frameworks, extract full page tree',
    img: 'raw/02-docs.png',
    highlightImg: 'raw/02-docs-highlight.png',
    accent: '#8a6d3b',
    accentRgb: '138, 109, 59',
  },
  {
    id: '03-ai-chat',
    num: '03',
    pill: 'AI Chat',
    title: 'AI 对话，秒变知识来源',
    subtitle: '支持 Claude · ChatGPT · Gemini，按问答对选择性导入',
    title_en: 'AI Chats → Knowledge Sources',
    subtitle_en: 'Claude · ChatGPT · Gemini — selectively import Q&A pairs',
    img: 'raw/03-ai-chat.png',
    highlightImg: 'raw/03-ai-chat-highlight.png',
    accent: '#5c7a5e',
    accentRgb: '92, 122, 94',
  },
  {
    id: '04-rescue',
    num: '04',
    pill: 'Smart Rescue',
    title: '失败来源？一键抢救',
    subtitle: '自动检测导入失败和假性成功的来源，批量修复',
    title_en: 'Failed Sources? One-Click Rescue',
    subtitle_en: 'Auto-detect failed & silently broken imports, batch repair',
    img: 'raw/04-rescue.png',
    highlightImg: 'raw/04-rescue-highlight.png',
    accent: '#b8734a',
    accentRgb: '184, 115, 74',
  },
  {
    id: '05-podcast',
    num: '05',
    pill: 'Podcast',
    title: '播客音频，下载即导入',
    subtitle: '支持 Apple Podcasts · 小宇宙，选集下载到 NotebookLM',
    title_en: 'Podcast Episodes, Ready to Import',
    subtitle_en: 'Apple Podcasts · Xiaoyuzhou — pick episodes, download audio',
    img: 'raw/05-podcast.png',
    highlightImg: 'raw/05-podcast-highlight.png',
    accent: '#7a5c6e',
    accentRgb: '122, 92, 110',
  },
];

const template = readFileSync(resolve(__dirname, 'template.html'), 'utf8');

function generateSlide(s, lang) {
  const isEn = lang === 'en';
  const title = isEn ? s.title_en : s.title;
  const subtitle = isEn ? s.subtitle_en : s.subtitle;
  const imgPrefix = isEn ? 'raw/en/' : 'raw/';
  const img = imgPrefix + s.img.replace('raw/', '');
  const highlightImg = imgPrefix + s.highlightImg.replace('raw/', '');

  const html = template
    .replace('--accent: #2563EB;', `--accent: ${s.accent};`)
    .replace(
      '--accent-light: rgba(37, 99, 235, 0.08);',
      `--accent-light: rgba(${s.accentRgb}, 0.08);`
    )
    .replace(
      '--accent-glow: rgba(37, 99, 235, 0.15);',
      `--accent-glow: rgba(${s.accentRgb}, 0.15);`
    )
    .replace('>01<', `>${s.num}<`)
    .replace('>Bookmarks<', `>${s.pill}<`)
    .replace(
      '>20 篇文章，只占 1 个来源配额<',
      `>${title}<`
    )
    .replace(
      '>收藏 → 聚合 → 导出 PDF → 突破 50 来源限制<',
      `>${subtitle}<`
    )
    .replace('id="base"', `id="base" style="background-image: url('${img}')"`)
    .replace(`src="raw/01-bookmarks-highlight.png"`, `src="${highlightImg}"`);

  return html;
}

let count = 0;
for (const s of slides) {
  // Chinese version
  const zhHtml = generateSlide(s, 'zh');
  const zhPath = resolve(__dirname, `_${s.id}.html`);
  writeFileSync(zhPath, zhHtml);
  console.log(`✓ _${s.id}.html       [zh] ${s.accent}`);
  count++;

  // English version
  const enHtml = generateSlide(s, 'en');
  const enPath = resolve(__dirname, `_${s.id}-en.html`);
  writeFileSync(enPath, enHtml);
  console.log(`✓ _${s.id}-en.html    [en] ${s.accent}`);
  count++;
}

console.log(`\nDone! ${count} slides generated (${slides.length} zh + ${slides.length} en).`);
console.log('Next: node docs/screenshots/render.mjs');
