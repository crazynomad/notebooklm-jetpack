/**
 * PDF Generator v6 — HTML → Markdown (Turndown) → HTML (marked GFM) → browser tab → print
 */

import { marked } from 'marked';
import TurndownService from 'turndown';
import type { DocPageItem, DocSiteInfo } from '@/lib/types';

// ── Turndown instance with custom rules for doc sites ──

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // DevSite: <pre class="devsite-click-to-copy"> → fenced code block
  td.addRule('devsiteCode', {
    filter: (node) =>
      node.nodeName === 'PRE' &&
      (node.getAttribute('class') || '').includes('devsite-click-to-copy'),
    replacement: (_content, node) => {
      const lang = (node.getAttribute('syntax') || '').toLowerCase();
      const codeEl = (node as Element).querySelector('code') || node;
      const text = codeEl.textContent || '';
      return `\n\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n\n`;
    },
  });

  // Remove <style> tags
  td.addRule('removeStyle', {
    filter: 'style',
    replacement: () => '',
  });

  // Remove devsite UI components (toc, ratings, nav, etc.)
  td.addRule('removeDevsiteUI', {
    filter: (node) => {
      const tag = node.nodeName.toLowerCase();
      return (
        tag.startsWith('devsite-') &&
        tag !== 'devsite-code' &&
        tag !== 'devsite-content'
      );
    },
    replacement: () => '',
  });

  // Remove breadcrumbs, sidebars, etc.
  td.addRule('removeNavElements', {
    filter: (node) => {
      const cl = node.getAttribute('class') || '';
      return /breadcrumb|sidebar|devsite-nav|devsite-toc/.test(cl);
    },
    replacement: () => '',
  });

  return td;
}

export interface PdfGeneratorOptions {
  concurrency?: number;
  maxPages?: number;
  onProgress?: (progress: PdfProgress) => void;
}

export interface PdfProgress {
  phase: 'fetching' | 'rendering' | 'done';
  current: number;
  total: number;
  currentPage?: string;
}

// ── Clean Mintlify/framework components from raw markdown ──

export function cleanComponentMd(md: string): string {
  md = md.replace(/^---[\s\S]*?---\n*/, '');
  md = md.replace(/<CardGroup[^>]*>[\s\S]*?<\/CardGroup>/g, '');
  md = md.replace(/<Card[^>]*>[\s\S]*?<\/Card>/g, '');
  md = md.replace(/<Steps>\s*/g, '');
  md = md.replace(/<\/Steps>\s*/g, '');
  md = md.replace(/<Step\s+title="([^"]*)"[^>]*>/g, '### $1\n');
  md = md.replace(/<\/Step>\s*/g, '');
  for (const tag of ['Note','Warning','Tip','Info','Caution']) {
    md = md.replace(new RegExp(`<${tag}>\\s*`, 'g'), `> **${tag}:** `);
    md = md.replace(new RegExp(`<\\/${tag}>\\s*`, 'g'), '\n');
  }
  md = md.replace(/<AccordionGroup>\s*/g, '');
  md = md.replace(/<\/AccordionGroup>\s*/g, '');
  md = md.replace(/<Accordion\s+title="([^"]*)"[^>]*>/g, '#### $1\n');
  md = md.replace(/<\/Accordion>\s*/g, '');
  md = md.replace(/<Tabs>\s*/g, '');
  md = md.replace(/<\/Tabs>\s*/g, '');
  md = md.replace(/<Tab\s+title="([^"]*)"[^>]*>/g, '**$1:**\n');
  md = md.replace(/<\/Tab>\s*/g, '');
  md = md.replace(/<Frame[^>]*>[\s\S]*?<\/Frame>/g, '');
  md = md.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '');
  md = md.replace(/<video[^>]*>[\s\S]*?<\/video>/gi, '');
  md = md.replace(/<img[^>]*\/?>/gi, '');
  md = md.replace(/<[A-Z][a-zA-Z]*[^>]*\/>/g, '');
  md = md.replace(/<\/?[A-Z][a-zA-Z]*[^>]*>/g, '');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

// ── Fetch pages ──

interface PageContent {
  url: string;
  title: string;
  markdown: string;
  section?: string;
  wordCount: number;
}

async function fetchPageContent(page: DocPageItem): Promise<PageContent | null> {
  // Strategy 1: Try .md suffix (returns clean markdown — works on Mintlify, VitePress, Bun, Clerk, etc.)
  try {
    const mdUrl = page.url.replace(/\/$/, '') + '.md';
    const r = await fetch(mdUrl, { signal: AbortSignal.timeout(8000) });
    if (r.ok) {
      const text = await r.text();
      const trimmed = text.trimStart();
      if (!trimmed.toLowerCase().startsWith('<!doctype') && !trimmed.toLowerCase().startsWith('<html') && text.length > 50) {
        const cleaned = cleanComponentMd(text);
        const title = cleaned.match(/^#\s+(.+)/m)?.[1] || page.title;
        return { url: page.url, title, markdown: cleaned, section: page.section, wordCount: cleaned.split(/\s+/).length };
      }
    }
  } catch { /* fall through */ }

  // Strategy 2: Fetch HTML and convert to Markdown via Turndown
  try {
    const r = await fetch(page.url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) return null;
    const html = await r.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const selectors = [
      '.devsite-article-body',  // Google DevSite (developer.chrome.com, etc.)
      '.markdown-body',         // GitHub-style
      'article [itemprop="articleBody"]',
      'article',
      'main',
      '[role="main"]',
      '#content',
      '.prose',
      '.content',
    ];
    let el: Element | null = null;
    for (const s of selectors) { el = doc.querySelector(s); if (el) break; }
    if (!el) el = doc.body;
    // Remove non-content elements before conversion
    el.querySelectorAll([
      'script', 'style', 'nav', 'footer', 'header',
      '.sidebar', '.toc', '.breadcrumb',
      '.devsite-article-meta', '.devsite-breadcrumb-list',
      'devsite-toc', 'devsite-page-rating', 'devsite-thumbs-rating',
      'devsite-feedback', 'devsite-bookmark',
      '.nocontent', '[role="navigation"]',
      '.devsite-banner',
    ].join(',')).forEach(e => e.remove());
    const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || page.title;
    // Convert HTML → Markdown using Turndown (preserves structure, code blocks, links, etc.)
    const td = createTurndownService();
    let markdown = td.turndown(el.innerHTML);
    // Post-process: remove leaked CSS blocks (e.g. .dcc-* rules from DevSite inline styles)
    markdown = markdown
      .replace(/\.dcc-[\s\S]*?\n\n/g, '\n\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    return { url: page.url, title, markdown, section: page.section, wordCount: markdown.split(/\s+/).length };
  } catch { return null; }
}

export async function fetchAllPages(pages: DocPageItem[], options: PdfGeneratorOptions): Promise<PageContent[]> {
  const concurrency = options.concurrency || 5;
  const results: PageContent[] = [];
  let completed = 0;
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fetchPageContent));
    for (const result of batchResults) {
      if (result && result.markdown.length > 50) results.push(result);
      completed++;
      options.onProgress?.({ phase: 'fetching', current: completed, total: pages.length, currentPage: batch[0]?.title });
    }
  }
  return results;
}

// ── GitHub markdown CSS ──

const CSS = `
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"; font-size: 14px; line-height: 1.6; color: #24292f; max-width: 860px; margin: 0 auto; padding: 20px 40px; }
@media print {
  body { font-size: 11px; padding: 0 15px; }
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
  @page { margin: 1.5cm; size: A4; }
}
h1 { font-size: 2em; border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 1.5em; }
h2 { font-size: 1.5em; border-bottom: 1px solid #d1d9e0; padding-bottom: .3em; margin-top: 1.4em; }
h3 { font-size: 1.25em; margin-top: 1.2em; }
h4 { font-size: 1em; margin-top: 1em; }
code { background: #f6f8fa; border-radius: 6px; padding: .2em .4em; font-size: 85%; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow-x: auto; line-height: 1.45; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #d0d7de; color: #656d76; padding: 0 1em; margin: .5em 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d1d9e0; padding: 6px 13px; }
th { background: #f6f8fa; font-weight: 600; }
tr:nth-child(even) { background: #f6f8fa; }
hr { border: none; border-top: 1px solid #d1d9e0; margin: 1.5em 0; }
ul, ol { padding-left: 2em; }
li { margin: .25em 0; }
.cover { text-align: center; padding-top: 180px; }
.cover h1 { border: none; color: #333; font-size: 2.5em; }
.cover .meta { color: #999; margin-top: 1.5em; }
.page-header { color: #999; font-size: .8em; margin-bottom: .3em; }
.page-source { color: #bbb; font-size: .75em; margin-top: 2em; border-top: 1px solid #eee; padding-top: .5em; }
.toc { background: #f6f8fa; border-radius: 8px; padding: 20px 28px; margin: 1em 0; }
.toc h2 { border: none; margin-top: 0; }
.toc ul { list-style: none; padding-left: 0; }
.toc li { margin: .15em 0; }
.toc li li { padding-left: 1.5em; }
.toc a { color: #0969da; text-decoration: none; }
`;

// ── Build full HTML document from pages ──

export function buildDocsHtml(siteInfo: DocSiteInfo, pages: PageContent[]): string {
  marked.setOptions({ gfm: true, breaks: false });

  const sections = new Map<string, PageContent[]>();
  for (const p of pages) {
    const s = p.section || 'General';
    if (!sections.has(s)) sections.set(s, []);
    sections.get(s)!.push(p);
  }

  // TOC
  let toc = '<div class="toc"><h2>Table of Contents</h2><ul>';
  for (const [sec, ps] of sections) {
    toc += `<li><strong>${sec}</strong><ul>`;
    for (const p of ps) toc += `<li><a href="#p-${encodeURIComponent(p.url)}">${p.title}</a></li>`;
    toc += '</ul></li>';
  }
  toc += '</ul></div>';

  // Pages
  let pagesHtml = '';
  for (const p of pages) {
    const html = marked.parse(p.markdown) as string;
    pagesHtml += `
      <div class="page-break"></div>
      <div class="page-header">${p.section || ''}</div>
      <div id="p-${encodeURIComponent(p.url)}">
        ${html}
      </div>
      <div class="page-source">${p.url}</div>
    `;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${siteInfo.title}</title>
  <style>${CSS}</style>
</head>
<body>
  <div class="cover">
    <h1>${siteInfo.title}</h1>
    <div class="meta">${pages.length} pages &middot; ${new Date().toISOString().split('T')[0]}</div>
    <div class="meta">Generated by NotebookLM Importer</div>
  </div>
  <div class="page-break"></div>
  ${toc}
  ${pagesHtml}
</body>
</html>`;
}

// ── Silent PDF export via chrome.debugger (CDP Page.printToPDF) ──

// Create blob URL in popup context (has DOM) and send to background for CDP PDF export
export function saveAsPdf(html: string, title: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const blobUrl = URL.createObjectURL(blob);
  chrome.runtime.sendMessage({
    type: 'EXPORT_PDF',
    blobUrl,
    title,
  });
}

// ── Public API ──

export async function generateDocsPdf(
  siteInfo: DocSiteInfo,
  options: PdfGeneratorOptions = {}
): Promise<void> {
  let contents: PageContent[];

  // Fast path: if site has llms-full.txt, use it (one request for all content)
  if (siteInfo.hasLlmsFullTxt) {
    options.onProgress?.({ phase: 'fetching', current: 0, total: 1, currentPage: 'llms-full.txt' });
    try {
      const origin = new URL(siteInfo.baseUrl).origin;
      const r = await fetch(`${origin}/llms-full.txt`, { signal: AbortSignal.timeout(30000) });
      if (r.ok) {
        const fullText = await r.text();
        if (fullText.length > 1000) {
          // Split into pages by h1 headers
          const sections = fullText.split(/(?=^# )/m).filter(s => s.trim().length > 50);
          contents = sections.map((section, i) => {
            const titleMatch = section.match(/^#\s+(.+)/m);
            const title = titleMatch?.[1] || `Section ${i + 1}`;
            const cleaned = cleanComponentMd(section);
            // Infer section from first h2 or directory-like structure
            const h2Match = cleaned.match(/^##\s+(.+)/m);
            return {
              url: `${origin}/#section-${i}`,
              title,
              markdown: cleaned,
              section: h2Match?.[1]?.slice(0, 30) || undefined,
              wordCount: cleaned.split(/\s+/).length,
            };
          });
          options.onProgress?.({ phase: 'fetching', current: 1, total: 1 });

          if (contents.length > 0) {
            options.onProgress?.({ phase: 'rendering', current: 1, total: 1 });
            const html = buildDocsHtml(siteInfo, contents);
            saveAsPdf(html, siteInfo.title);
            options.onProgress?.({ phase: 'done', current: 1, total: 1 });
            return;
          }
        }
      }
    } catch { /* fall through to per-page fetching */ }
  }

  // Standard path: fetch pages individually
  const maxPages = options.maxPages || 1000;
  const pagesToFetch = siteInfo.pages.slice(0, maxPages);

  contents = await fetchAllPages(pagesToFetch, options);
  if (contents.length === 0) throw new Error('No page content could be fetched');

  options.onProgress?.({ phase: 'rendering', current: 1, total: 1 });

  const html = buildDocsHtml(siteInfo, contents);
  saveAsPdf(html, siteInfo.title);

  options.onProgress?.({ phase: 'done', current: 1, total: 1 });
}

/** Download HTML directly (alternative to print) */
export function downloadHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
