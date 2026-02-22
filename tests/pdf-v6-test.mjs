#!/usr/bin/env node
/**
 * v6: llms-full.txt → split pages → marked GFM → HTML → Chrome print
 * One request gets ALL content. Beautiful rendering. Perfect formatting.
 */
import { marked } from 'marked';
import fs from 'fs';
import { execSync } from 'child_process';

const OUT_HTML = '/tmp/openclaw-docs-v6.html';
const OUT_PDF = '/tmp/openclaw-docs-v6.pdf';

const CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji"; font-size: 13px; line-height: 1.6; color: #24292f; max-width: 860px; margin: 0 auto; padding: 20px 40px; }
@media print {
  body { font-size: 10pt; padding: 0; }
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
  pre, blockquote, table { page-break-inside: avoid; }
  h1, h2, h3, h4 { page-break-after: avoid; }
  @page { margin: 1.8cm 1.5cm; size: A4; }
}
h1 { font-size: 1.8em; border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 1.5em; }
h2 { font-size: 1.4em; border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 1.3em; }
h3 { font-size: 1.15em; margin-top: 1.1em; }
h4 { font-size: 1em; margin-top: .9em; }
code { background: #f6f8fa; border-radius: 6px; padding: .2em .4em; font-size: 85%; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
pre { background: #f6f8fa; border-radius: 6px; padding: 14px; overflow-x: auto; line-height: 1.45; font-size: 12px; }
pre code { background: none; padding: 0; font-size: inherit; }
blockquote { border-left: 3px solid #d0d7de; color: #656d76; padding: 0 1em; margin: .5em 0; }
table { border-collapse: collapse; width: 100%; margin: .8em 0; font-size: 0.9em; }
th, td { border: 1px solid #d1d9e0; padding: 5px 10px; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
hr { border: none; border-top: 1px solid #d1d9e0; margin: 1.5em 0; }
ul, ol { padding-left: 2em; }
li { margin: .2em 0; }
.cover { text-align: center; padding-top: 200px; }
.cover h1 { border: none; color: #FF5A36; font-size: 2.5em; margin-bottom: .2em; }
.cover .sub { font-size: 1.3em; color: #666; }
.cover .meta { color: #999; margin-top: 1.5em; font-size: .95em; }
.toc { background: #f6f8fa; border-radius: 8px; padding: 20px 28px; margin: 1em 0; columns: 2; column-gap: 2em; }
.toc h2 { border: none; margin-top: 0; column-span: all; }
.toc ul { list-style: none; padding-left: 0; margin: 0; }
.toc li { margin: .12em 0; break-inside: avoid; font-size: .85em; }
.toc a { color: #0969da; text-decoration: none; }
.page-source { color: #bbb; font-size: .7em; margin-bottom: 1em; }
`;

function cleanMd(md) {
  // Strip Mintlify components but keep content
  md = md.replace(/<CardGroup[^>]*>[\s\S]*?<\/CardGroup>/g, '');
  md = md.replace(/<Card[^>]*>[\s\S]*?<\/Card>/g, '');
  md = md.replace(/<Steps>\s*/g, ''); md = md.replace(/<\/Steps>\s*/g, '');
  md = md.replace(/<Step\s+title="([^"]*)"[^>]*>/g, '**$1**\n\n');
  md = md.replace(/<\/Step>\s*/g, '');
  for (const t of ['Note','Warning','Tip','Info','Caution']) {
    md = md.replace(new RegExp(`<${t}>\\s*`, 'gi'), `> **${t}:** `);
    md = md.replace(new RegExp(`<\\/${t}>\\s*`, 'gi'), '\n');
  }
  md = md.replace(/<AccordionGroup>\s*/g, ''); md = md.replace(/<\/AccordionGroup>\s*/g, '');
  md = md.replace(/<Accordion\s+title="([^"]*)"[^>]*>/g, '#### $1\n');
  md = md.replace(/<\/Accordion>\s*/g, '');
  md = md.replace(/<Tabs>\s*/g, ''); md = md.replace(/<\/Tabs>\s*/g, '');
  md = md.replace(/<Tab\s+title="([^"]*)"[^>]*>/g, '**$1:**\n');
  md = md.replace(/<\/Tab>\s*/g, '');
  md = md.replace(/<Frame[^>]*>[\s\S]*?<\/Frame>/g, '');
  md = md.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '[video]');
  md = md.replace(/<img[^>]*\/?>/gi, '');
  md = md.replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '');
  md = md.replace(/<\/?[A-Z][a-zA-Z]*[^>]*>/g, '');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

async function main() {
  console.log('v6: llms-full.txt → PDF (one request for ALL content)\n');

  // 1. Fetch llms-full.txt — ALL docs in one request!
  console.log('Fetching llms-full.txt...');
  const r = await fetch('https://docs.openclaw.ai/llms-full.txt');
  const fullText = await r.text();
  console.log(`  ${(fullText.length / 1024).toFixed(0)} KB, ${fullText.split('\n').length} lines\n`);

  // 2. Split into pages (each page starts with "# Title\nSource: url")
  const pageBlocks = fullText.split(/(?=^# [^\n]+\nSource: )/m).filter(b => b.trim());
  console.log(`  ${pageBlocks.length} pages found\n`);

  // 3. Parse each page
  const pages = [];
  for (const block of pageBlocks) {
    const titleMatch = block.match(/^# (.+)/);
    const sourceMatch = block.match(/^Source: (.+)/m);
    if (!titleMatch) continue;

    const title = titleMatch[1];
    const source = sourceMatch?.[1] || '';
    // Remove the title and source lines, keep the rest as content
    let content = block.replace(/^# .+\n/, '').replace(/^Source: .+\n/, '');
    content = cleanMd(content);
    if (content.length < 20) continue;

    pages.push({ title, source, content });
  }
  console.log(`  ${pages.length} pages with content\n`);

  // 4. Build HTML
  marked.setOptions({ gfm: true, breaks: false });

  // Cover
  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenClaw Documentation</title><style>${CSS}</style></head><body>`;
  html += `<div class="cover"><h1>OpenClaw</h1><p class="sub">Documentation</p>`;
  html += `<div class="meta">${pages.length} pages · ${new Date().toISOString().split('T')[0]}</div>`;
  html += `<div class="meta">Generated by NotebookLM Importer via llms-full.txt</div></div>`;

  // TOC
  html += `<div class="page-break"></div><div class="toc"><h2>Table of Contents</h2><ul>`;
  for (let i = 0; i < pages.length; i++) {
    html += `<li><a href="#p${i}">${pages[i].title}</a></li>`;
  }
  html += `</ul></div>`;

  // Pages
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const rendered = marked.parse(p.content);
    html += `<div class="page-break" id="p${i}"></div>`;
    html += `<div class="page-source">${p.source}</div>`;
    html += `<h1>${p.title}</h1>`;
    html += rendered;
  }

  html += `</body></html>`;

  fs.writeFileSync(OUT_HTML, html);
  console.log(`HTML: ${OUT_HTML} (${(fs.statSync(OUT_HTML).size / 1024).toFixed(0)} KB)`);

  // 5. Chrome headless → PDF
  console.log('Generating PDF...');
  try {
    execSync(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${OUT_PDF}" --print-to-pdf-no-header "${OUT_HTML}" 2>/dev/null`, { timeout: 60000 });
    console.log(`PDF: ${OUT_PDF} (${(fs.statSync(OUT_PDF).size / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log('PDF generation failed, opening HTML instead');
  }

  execSync(`open "${OUT_HTML}"`);
  if (fs.existsSync(OUT_PDF)) execSync(`open "${OUT_PDF}"`);
}

main().catch(console.error);
