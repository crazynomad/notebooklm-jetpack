#!/usr/bin/env node
/**
 * Test: Chrome Extension docs (developer.chrome.com) → Turndown → Markdown → HTML → PDF
 * Validates that Strategy 2 (Turndown) produces clean output for DevSite pages.
 */
import TurndownService from 'turndown';
import { marked } from 'marked';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import { execSync } from 'child_process';

const OUT_HTML = '/tmp/chrome-ext-docs.html';
const OUT_PDF = '/tmp/chrome-ext-docs.pdf';

// Pages to test (mix of API ref + guides)
const TEST_PAGES = [
  { url: 'https://developer.chrome.com/docs/extensions/reference/api/tabs', title: 'chrome.tabs' },
  { url: 'https://developer.chrome.com/docs/extensions/reference/api/runtime', title: 'chrome.runtime' },
  { url: 'https://developer.chrome.com/docs/extensions/reference/api/storage', title: 'chrome.storage' },
  { url: 'https://developer.chrome.com/docs/extensions/reference/api/scripting', title: 'chrome.scripting' },
  { url: 'https://developer.chrome.com/docs/extensions/reference/api/action', title: 'chrome.action' },
];

// ── Turndown with DevSite rules (mirrors pdf-generator.ts) ──

function createTurndownService() {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  td.addRule('devsiteCode', {
    filter: (node) =>
      node.nodeName === 'PRE' &&
      (node.getAttribute('class') || '').includes('devsite-click-to-copy'),
    replacement: (_content, node) => {
      const lang = (node.getAttribute('syntax') || '').toLowerCase();
      const codeEl = node.querySelector('code') || node;
      const text = codeEl.textContent || '';
      return `\n\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n\n`;
    },
  });

  td.addRule('removeStyle', {
    filter: 'style',
    replacement: () => '',
  });

  td.addRule('removeDevsiteUI', {
    filter: (node) => {
      const tag = node.nodeName.toLowerCase();
      return tag.startsWith('devsite-') && tag !== 'devsite-code' && tag !== 'devsite-content';
    },
    replacement: () => '',
  });

  td.addRule('removeNavElements', {
    filter: (node) => {
      const cl = node.getAttribute('class') || '';
      return /breadcrumb|sidebar|devsite-nav|devsite-toc/.test(cl);
    },
    replacement: () => '',
  });

  return td;
}

// ── Fetch and convert a page ──

async function fetchPage(url, pageTitle) {
  const r = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`HTTP ${r.status} for ${url}`);
  const html = await r.text();
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  const selectors = ['article', 'main', '[role="main"]', '#content', '.prose', '.content'];
  let el = null;
  for (const s of selectors) { el = doc.querySelector(s); if (el) break; }
  if (!el) el = doc.body;

  el.querySelectorAll('script,style,nav,footer,header,.sidebar,.toc,.breadcrumb').forEach(e => e.remove());

  const title = doc.querySelector('h1')?.textContent?.trim() || pageTitle;

  const td = createTurndownService();
  let markdown = td.turndown(el.innerHTML);

  // Post-process
  markdown = markdown
    .replace(/\.dcc-[\s\S]*?\n\n/g, '\n\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { url, title, markdown };
}

// ── Quality checks ──

function analyzeMarkdown(md, title) {
  const lines = md.split('\n');
  const stats = {
    title,
    totalLines: lines.length,
    totalChars: md.length,
    headings: lines.filter(l => /^#{1,4}\s/.test(l)).length,
    codeBlocks: (md.match(/^```/gm) || []).length / 2,
    links: (md.match(/\[([^\]]+)\]\(/g) || []).length,
    listItems: lines.filter(l => /^[-*]\s/.test(l.trim())).length,
    rawHtmlTags: (md.match(/<[a-z][a-z0-9]*[\s>]/gi) || []).length,
    cssLeaks: (md.match(/\.dcc-|devsite-syntax|background-image:url/g) || []).length,
    emptyContent: md.length < 200,
  };
  return stats;
}

// ── CSS ──

const CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #24292f; max-width: 860px; margin: 0 auto; padding: 20px 40px; }
@media print {
  body { font-size: 10pt; padding: 0; }
  .page-break { page-break-before: always; }
  pre, blockquote, table { page-break-inside: avoid; }
  h1, h2, h3 { page-break-after: avoid; }
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
ul, ol { padding-left: 2em; }
li { margin: .2em 0; }
.cover { text-align: center; padding-top: 200px; }
.cover h1 { border: none; color: #1a73e8; font-size: 2.5em; }
.cover .meta { color: #999; margin-top: 1.5em; }
.page-source { color: #bbb; font-size: .7em; margin-bottom: .5em; }
.quality-report { background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 16px; margin: 1em 0; font-size: 12px; }
.quality-report h3 { margin-top: 0; color: #0369a1; }
.pass { color: #16a34a; } .fail { color: #dc2626; } .warn { color: #d97706; }
`;

// ── Main ──

async function main() {
  console.log('Chrome Extension Docs → Turndown → PDF Test\n');
  console.log(`Testing ${TEST_PAGES.length} pages from developer.chrome.com\n`);

  const pages = [];
  const allStats = [];

  for (const p of TEST_PAGES) {
    process.stdout.write(`  Fetching ${p.title}...`);
    try {
      const page = await fetchPage(p.url, p.title);
      pages.push(page);
      const stats = analyzeMarkdown(page.markdown, page.title);
      allStats.push(stats);
      console.log(` ✅ ${stats.totalLines} lines, ${stats.headings} headings, ${stats.codeBlocks} code blocks, ${stats.rawHtmlTags} raw HTML tags`);
    } catch (e) {
      console.log(` ❌ ${e.message}`);
    }
  }

  // Quality report
  console.log('\n=== Quality Report ===\n');
  let totalIssues = 0;
  for (const s of allStats) {
    const issues = [];
    if (s.emptyContent) issues.push('EMPTY CONTENT');
    if (s.cssLeaks > 0) issues.push(`${s.cssLeaks} CSS leaks`);
    if (s.rawHtmlTags > 50) issues.push(`${s.rawHtmlTags} raw HTML tags (high)`);
    if (s.headings === 0) issues.push('No headings');
    if (s.codeBlocks === 0) issues.push('No code blocks');

    const status = issues.length === 0 ? '✅ PASS' : `⚠️  ${issues.join(', ')}`;
    console.log(`  ${s.title}: ${status}`);
    console.log(`    ${s.totalChars} chars, ${s.headings} headings, ${s.codeBlocks} code blocks, ${s.links} links, ${s.listItems} list items`);
    totalIssues += issues.length;
  }

  console.log(`\n  Overall: ${totalIssues === 0 ? '✅ ALL PASS' : `⚠️  ${totalIssues} issues found`}\n`);

  if (pages.length === 0) {
    console.log('No pages fetched, aborting.');
    process.exit(1);
  }

  // Build HTML
  marked.setOptions({ gfm: true, breaks: false });

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Chrome Extension API Reference</title><style>${CSS}</style></head><body>`;
  html += `<div class="cover"><h1>Chrome Extension API</h1>`;
  html += `<div class="meta">${pages.length} pages · ${new Date().toISOString().split('T')[0]}</div>`;
  html += `<div class="meta">Generated via Turndown (Strategy 2 test)</div></div>`;

  // Quality report page
  html += `<div class="page-break"></div>`;
  html += `<div class="quality-report"><h3>📊 Quality Report</h3><table><tr><th>Page</th><th>Chars</th><th>Headings</th><th>Code Blocks</th><th>Links</th><th>Raw HTML</th><th>CSS Leaks</th></tr>`;
  for (const s of allStats) {
    const htmlClass = s.rawHtmlTags > 50 ? 'warn' : s.rawHtmlTags > 10 ? '' : 'pass';
    const cssClass = s.cssLeaks > 0 ? 'fail' : 'pass';
    html += `<tr><td>${s.title}</td><td>${s.totalChars}</td><td>${s.headings}</td><td>${s.codeBlocks}</td><td>${s.links}</td><td class="${htmlClass}">${s.rawHtmlTags}</td><td class="${cssClass}">${s.cssLeaks}</td></tr>`;
  }
  html += `</table></div>`;

  // Content pages
  for (const p of pages) {
    const rendered = marked.parse(p.markdown);
    html += `<div class="page-break"></div>`;
    html += `<div class="page-source">${p.url}</div>`;
    html += rendered;
  }

  html += `</body></html>`;

  fs.writeFileSync(OUT_HTML, html);
  console.log(`HTML: ${OUT_HTML} (${(fs.statSync(OUT_HTML).size / 1024).toFixed(0)} KB)`);

  // Chrome headless → PDF
  console.log('Generating PDF...');
  try {
    execSync(`"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --disable-gpu --run-all-compositor-stages-before-draw --print-to-pdf="${OUT_PDF}" --print-to-pdf-no-header "${OUT_HTML}" 2>/dev/null`, { timeout: 60000 });
    const pdfSize = fs.statSync(OUT_PDF).size;
    console.log(`PDF: ${OUT_PDF} (${(pdfSize / 1024).toFixed(0)} KB)`);
  } catch (e) {
    console.log('PDF generation failed, opening HTML only');
  }

  execSync(`open "${OUT_HTML}"`);
  if (fs.existsSync(OUT_PDF)) execSync(`open "${OUT_PDF}"`);
}

main().catch(console.error);
