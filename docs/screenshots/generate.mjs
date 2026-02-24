// Generate 1280x800 store screenshots from template
// Usage: node generate.mjs (requires puppeteer or playwright)

import { execSync } from 'child_process';
import { writeFileSync, readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

const slides = [
  {
    id: '01-bookmarks',
    title: '20 篇文章，只占 1 个来源配额',
    subtitle: '收藏 → 聚合 → 导出 PDF → 突破 50 来源限制',
    img: 'raw/01-bookmarks.jpg',
  },
  {
    id: '02-docs',
    title: '整个文档站，一键导入',
    subtitle: '自动识别 14+ 框架，提取全站页面树',
    img: 'raw/02-docs.jpg',
  },
  {
    id: '03-ai-chat',
    title: 'AI 对话，秒变知识来源',
    subtitle: '支持 Claude · ChatGPT · Gemini，按问答对选择性导入',
    img: 'raw/03-ai-chat.jpg',
  },
  {
    id: '04-rescue',
    title: '失败来源？一键抢救',
    subtitle: '自动检测导入失败和假性成功的来源，批量修复',
    img: 'raw/04-rescue.jpg',
  },
  {
    id: '05-podcast',
    title: '播客音频，下载即导入',
    subtitle: '支持 Apple Podcasts · 小宇宙，选集下载到 NotebookLM',
    img: 'raw/05-podcast.jpg',
  },
];

// Generate HTML for each slide
for (const slide of slides) {
  const template = readFileSync(resolve(__dirname, 'template.html'), 'utf8');
  const html = template
    .replace('id="title">20 篇文章，只占 1 个来源配额', `id="title">${slide.title}`)
    .replace('id="subtitle">收藏 → 聚合 → 导出 PDF → 突破 50 来源限制', `id="subtitle">${slide.subtitle}`)
    .replace('src="raw/01-bookmarks.jpg"', `src="${slide.img}"`);
  
  const htmlPath = resolve(__dirname, `_${slide.id}.html`);
  writeFileSync(htmlPath, html);
  console.log(`Generated: _${slide.id}.html`);
}

console.log('\nOpen each HTML in a 1280x800 browser window and screenshot.');
console.log('Or use: npx playwright screenshot --viewport-size=1280,800 <file> <output.png>');
