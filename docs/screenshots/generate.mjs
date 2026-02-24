// Generate 1280x800 store screenshots from template
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
    img: 'raw/01-bookmarks.png',
    highlightImg: 'raw/01-bookmarks-highlight.png',
    accent: '#059669',
    accentRgb: '5, 150, 105',
  },
  {
    id: '02-docs',
    num: '02',
    pill: 'Doc Sites',
    title: '整个文档站，一键导入',
    subtitle: '自动识别 14+ 框架，提取全站页面树',
    img: 'raw/02-docs.png',
    highlightImg: 'raw/02-docs-highlight.png',
    accent: '#7C3AED',
    accentRgb: '124, 58, 237',
  },
  {
    id: '03-ai-chat',
    num: '03',
    pill: 'AI Chat',
    title: 'AI 对话，秒变知识来源',
    subtitle: '支持 Claude · ChatGPT · Gemini，按问答对选择性导入',
    img: 'raw/03-ai-chat.png',
    highlightImg: 'raw/03-ai-chat-highlight.png',
    accent: '#2563EB',
    accentRgb: '37, 99, 235',
  },
  {
    id: '04-rescue',
    num: '04',
    pill: 'Smart Rescue',
    title: '失败来源？一键抢救',
    subtitle: '自动检测导入失败和假性成功的来源，批量修复',
    img: 'raw/04-rescue.png',
    highlightImg: 'raw/04-rescue-highlight.png',
    accent: '#D97706',
    accentRgb: '217, 119, 6',
  },
  {
    id: '05-podcast',
    num: '05',
    pill: 'Podcast',
    title: '播客音频，下载即导入',
    subtitle: '支持 Apple Podcasts · 小宇宙，选集下载到 NotebookLM',
    img: 'raw/05-podcast.png',
    highlightImg: 'raw/05-podcast-highlight.png',
    accent: '#E11D48',
    accentRgb: '225, 29, 72',
  },
];

const template = readFileSync(resolve(__dirname, 'template.html'), 'utf8');

for (const s of slides) {
  const html = template
    // -- CSS custom properties --
    .replace('--accent: #2563EB;', `--accent: ${s.accent};`)
    .replace(
      '--accent-light: rgba(37, 99, 235, 0.08);',
      `--accent-light: rgba(${s.accentRgb}, 0.08);`
    )
    .replace(
      '--accent-glow: rgba(37, 99, 235, 0.15);',
      `--accent-glow: rgba(${s.accentRgb}, 0.15);`
    )
    // -- Content --
    .replace('>01<', `>${s.num}<`)
    .replace('>Bookmarks<', `>${s.pill}<`)
    .replace(
      '>20 篇文章，只占 1 个来源配额<',
      `>${s.title}<`
    )
    .replace(
      '>收藏 → 聚合 → 导出 PDF → 突破 50 来源限制<',
      `>${s.subtitle}<`
    )
    // -- Images: base (full screenshot) + highlight (cropped foreground) --
    .replace('id="base"', `id="base" style="background-image: url('${s.img}')"`)
    .replace(`src="raw/01-bookmarks-highlight.png"`, `src="${s.highlightImg}"`);

  const outPath = resolve(__dirname, `_${s.id}.html`);
  writeFileSync(outPath, html);
  console.log(`✓ _${s.id}.html  [${s.accent}]`);
}

console.log(`\nDone! ${slides.length} slides generated.`);
console.log('Next: node docs/screenshots/render.mjs');
