/**
 * PDF Generator v6 — HTML → Markdown (Turndown) → HTML (marked GFM) → browser tab → print
 */

import { marked } from 'marked';
import type { DocPageItem, DocSiteInfo } from '@/lib/types';

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

// ── HTML → Markdown via regex (no DOM dependency, safe for Service Worker) ──

function htmlToMarkdown(html: string): string {
  let md = html;

  // Remove script, style, svg
  md = md.replace(/<script[\s\S]*?<\/script>/gi, '');
  md = md.replace(/<style[\s\S]*?<\/style>/gi, '');
  md = md.replace(/<svg[\s\S]*?<\/svg>/gi, '');

  // Code blocks: <pre><code>...</code></pre> → fenced code blocks
  md = md.replace(/<pre[^>]*>\s*<code[^>]*(?:class="[^"]*language-(\w+)[^"]*")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/gi,
    (_m, lang, code) => `\n\n\`\`\`${lang || ''}\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`);
  // Bare <pre>
  md = md.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi,
    (_m, code) => `\n\n\`\`\`\n${decodeHtmlEntities(code.trim())}\n\`\`\`\n\n`);

  // Headings
  md = md.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, (_m, t) => `\n\n# ${stripTags(t).trim()}\n\n`);
  md = md.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, (_m, t) => `\n\n## ${stripTags(t).trim()}\n\n`);
  md = md.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, (_m, t) => `\n\n### ${stripTags(t).trim()}\n\n`);
  md = md.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, (_m, t) => `\n\n#### ${stripTags(t).trim()}\n\n`);
  md = md.replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, (_m, t) => `\n\n##### ${stripTags(t).trim()}\n\n`);
  md = md.replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, (_m, t) => `\n\n###### ${stripTags(t).trim()}\n\n`);

  // Inline code
  md = md.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (_m, c) => `\`${decodeHtmlEntities(c.trim())}\``);

  // Bold / Italic
  md = md.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_m, t) => `**${stripTags(t).trim()}**`);
  md = md.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_m, t) => `*${stripTags(t).trim()}*`);

  // Links
  md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, text) => {
    const t = stripTags(text).trim();
    return t ? `[${t}](${href})` : '';
  });

  // Images
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');

  // List items
  md = md.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, t) => `- ${stripTags(t).trim()}\n`);

  // Blockquotes
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, (_m, t) => {
    return stripTags(t).trim().split('\n').map(l => `> ${l}`).join('\n') + '\n\n';
  });

  // Tables: basic conversion
  md = md.replace(/<table[\s\S]*?<\/table>/gi, (table) => {
    const rows: string[][] = [];
    const rowMatches = table.match(/<tr[\s\S]*?<\/tr>/gi) || [];
    for (const row of rowMatches) {
      const cells = (row.match(/<(?:td|th)[^>]*>[\s\S]*?<\/(?:td|th)>/gi) || [])
        .map(c => stripTags(c.replace(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/i, '$1')).trim());
      if (cells.length) rows.push(cells);
    }
    if (rows.length === 0) return '';
    const maxCols = Math.max(...rows.map(r => r.length));
    const padded = rows.map(r => { while (r.length < maxCols) r.push(''); return r; });
    let result = '\n\n';
    result += '| ' + padded[0].join(' | ') + ' |\n';
    result += '| ' + padded[0].map(() => '---').join(' | ') + ' |\n';
    for (let i = 1; i < padded.length; i++) {
      result += '| ' + padded[i].join(' | ') + ' |\n';
    }
    return result + '\n';
  });

  // Paragraphs and line breaks
  md = md.replace(/<br\s*\/?>/gi, '\n');
  md = md.replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (_m, t) => `\n\n${stripTags(t).trim()}\n\n`);
  md = md.replace(/<hr[^>]*\/?>/gi, '\n\n---\n\n');

  // Remove remaining HTML tags
  md = md.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  md = decodeHtmlEntities(md);

  // Clean up whitespace
  md = md.replace(/\n{3,}/g, '\n\n').trim();

  return md;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, n) => String.fromCharCode(parseInt(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, n) => String.fromCharCode(parseInt(n, 16)));
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
  console.log('[fetchPage] Starting:', page.url);

  // Strategy 1: Try .md suffix (returns clean markdown — works on Mintlify, VitePress, Bun, Clerk, etc.)
  try {
    const mdUrl = page.url.replace(/\/$/, '') + '.md';
    const r = await fetch(mdUrl, { signal: AbortSignal.timeout(8000) });
    console.log('[fetchPage] .md probe:', r.status, mdUrl);
    if (r.ok) {
      const text = await r.text();
      const trimmed = text.trimStart();
      if (!trimmed.toLowerCase().startsWith('<!doctype') && !trimmed.toLowerCase().startsWith('<html') && text.length > 50) {
        const cleaned = cleanComponentMd(text);
        const title = cleaned.match(/^#\s+(.+)/m)?.[1] || page.title;
        console.log('[fetchPage] Strategy 1 success, markdown length:', cleaned.length);
        return { url: page.url, title, markdown: cleaned, section: page.section, wordCount: cleaned.split(/\s+/).length };
      } else {
        console.log('[fetchPage] .md returned HTML or too short, falling through');
      }
    }
  } catch (err) { console.log('[fetchPage] .md probe failed:', err); }

  // Strategy 2: Fetch HTML and convert to Markdown via Turndown
  try {
    console.log('[fetchPage] Strategy 2: fetching HTML...');
    const r = await fetch(page.url, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) { console.log('[fetchPage] HTML fetch failed:', r.status); return null; }
    const html = await r.text();
    console.log('[fetchPage] HTML fetched, size:', html.length);

    // Extract content region via regex (DOMParser can hang in Service Worker for large HTML)
    let contentHtml = html;
    const contentPatterns = [
      // Google DevSite
      { start: /<div\s+class="devsite-article-body[^"]*"[^>]*>/i, end: null, name: 'devsite-article-body' },
      // GitHub-style
      { start: /<div\s+class="markdown-body[^"]*"[^>]*>/i, end: null, name: 'markdown-body' },
      // Generic article/main
      { start: /<article[^>]*>/i, end: /<\/article>/i, name: 'article' },
      { start: /<main[^>]*>/i, end: /<\/main>/i, name: 'main' },
    ];

    let matchedSelector = 'full page';
    for (const pattern of contentPatterns) {
      const startMatch = pattern.start.exec(html);
      if (startMatch) {
        const startIdx = startMatch.index;
        // Find the matching closing tag by counting nesting
        const tagName = pattern.name.includes('-') ? 'div' : pattern.name;
        let depth = 1;
        let idx = startIdx + startMatch[0].length;
        const openRe = new RegExp(`<${tagName}[\\s>]`, 'gi');
        const closeRe = new RegExp(`</${tagName}>`, 'gi');

        // Simple approach: grab from start to a reasonable end
        if (pattern.end) {
          closeRe.lastIndex = idx;
          const endMatch = pattern.end.exec(html);
          if (endMatch) {
            contentHtml = html.slice(startIdx, endMatch.index + endMatch[0].length);
            matchedSelector = pattern.name;
            break;
          }
        } else {
          // For div-based selectors, grab a large chunk and find balanced close
          const chunk = html.slice(startIdx, startIdx + html.length);
          let pos = startMatch[0].length;
          let nestDepth = 1;
          const divOpenRe = /<div[\s>]/gi;
          const divCloseRe = /<\/div>/gi;
          divOpenRe.lastIndex = pos;
          divCloseRe.lastIndex = pos;

          while (nestDepth > 0 && pos < chunk.length) {
            divOpenRe.lastIndex = pos;
            divCloseRe.lastIndex = pos;
            const nextOpen = divOpenRe.exec(chunk);
            const nextClose = divCloseRe.exec(chunk);

            if (!nextClose) break;
            if (nextOpen && nextOpen.index < nextClose.index) {
              nestDepth++;
              pos = nextOpen.index + nextOpen[0].length;
            } else {
              nestDepth--;
              if (nestDepth === 0) {
                contentHtml = chunk.slice(0, nextClose.index + nextClose[0].length);
                matchedSelector = pattern.name;
                break;
              }
              pos = nextClose.index + nextClose[0].length;
            }
          }
          if (matchedSelector !== 'full page') break;
        }
      }
    }
    console.log('[fetchPage] Content extracted via:', matchedSelector, '| length:', contentHtml.length);

    // Strip non-content tags via regex
    contentHtml = contentHtml
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<nav[\s\S]*?<\/nav>/gi, '')
      .replace(/<footer[\s\S]*?<\/footer>/gi, '')
      .replace(/<header[\s\S]*?<\/header>/gi, '')
      .replace(/<devsite-toc[\s\S]*?<\/devsite-toc>/gi, '')
      .replace(/<devsite-page-rating[\s\S]*?<\/devsite-page-rating>/gi, '')
      .replace(/<devsite-thumbs-rating[\s\S]*?<\/devsite-thumbs-rating>/gi, '')
      .replace(/<devsite-feedback[\s\S]*?<\/devsite-feedback>/gi, '')
      .replace(/<devsite-bookmark[\s\S]*?<\/devsite-bookmark>/gi, '')
      .replace(/<div[^>]*class="[^"]*(?:breadcrumb|nocontent|devsite-article-meta)[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '');
    console.log('[fetchPage] After cleanup, length:', contentHtml.length);

    // Extract title from h1
    const h1Match = contentHtml.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
    const titleText = h1Match ? h1Match[1].replace(/<[^>]+>/g, '').trim() : '';
    const title = titleText || page.title;

    // Convert HTML → Markdown via regex (Turndown hangs in Service Worker)
    console.log('[fetchPage] Converting HTML to markdown via regex...');
    let markdown = htmlToMarkdown(contentHtml);
    console.log('[fetchPage] Conversion done, markdown length:', markdown.length);
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
