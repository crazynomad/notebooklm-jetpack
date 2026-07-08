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

// ── Offscreen document for HTML→Markdown (DOMParser + Turndown need DOM) ──

import { ensureOffscreen, sendOffscreenMessage } from '@/services/offscreen';

export async function convertHtmlToMarkdown(html: string): Promise<{ markdown: string; title: string }> {
  await ensureOffscreen();
  return sendOffscreenMessage<{ success: true; markdown: string; title: string }>(
    { type: 'HTML_TO_MARKDOWN', html },
  ).then(r => ({ markdown: r.markdown, title: r.title }));
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

    // Send to offscreen document for DOMParser + Turndown conversion
    console.log('[fetchPage] Sending to offscreen for conversion...');
    const result = await convertHtmlToMarkdown(html);
    console.log('[fetchPage] Offscreen returned, markdown length:', result.markdown.length);

    const title = result.title || page.title;
    let markdown = result.markdown
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
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Noto+Serif+SC:wght@400;500;600;700&family=EB+Garamond:ital,wght@0,400;0,500;1,400;1,500&display=swap');
body { font-family: "Noto Serif SC", Georgia, "Songti SC", "STSong", "SimSun", "Noto Serif CJK SC", serif; font-size: 15px; line-height: 1.9; color: #1a1612; background: #f6f1ea; max-width: 820px; margin: 0 auto; padding: 24px 48px; -webkit-font-smoothing: antialiased; }
@media print {
  body { font-size: 12px; padding: 0 15px; background: #f6f1ea; }
  .page-break { page-break-before: always; }
  .no-break { page-break-inside: avoid; }
  @page { margin: 1.5cm; size: A4; }
}
h1 { font-family: "Noto Serif SC", serif; font-size: 1.8em; border-bottom: 1px solid #d4c9ba; padding-bottom: .3em; margin-top: 1.8em; color: #1a1612; letter-spacing: .02em; }
h2 { font-family: "Noto Serif SC", serif; font-size: 1.4em; border-bottom: 1px solid #d4c9ba; padding-bottom: .3em; margin-top: 1.6em; color: #2a2420; }
h3 { font-size: 1.2em; margin-top: 1.4em; color: #2a2420; }
h4 { font-size: 1em; margin-top: 1.2em; color: #3a3430; }
p { margin: .8em 0; }
img { max-width: 100%; height: auto; margin: 1em 0; border-radius: 6px; }
code { background: #eee8de; border-radius: 4px; padding: .15em .4em; font-size: 85%; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; color: #5c4a3a; }
pre { background: #eee8de; border-radius: 6px; padding: 16px; overflow-x: auto; line-height: 1.5; }
pre code { background: none; padding: 0; }
blockquote { border-left: 3px solid #c4553a; color: #5c5147; background: #eee8de; padding: .6em 1em; margin: 1em 0; border-radius: 0 6px 6px 0; }
table { border-collapse: collapse; width: 100%; margin: 1em 0; }
th, td { border: 1px solid #d4c9ba; padding: 8px 14px; }
th { background: #eee8de; font-weight: 600; color: #2a2420; }
tr:nth-child(even) { background: #ede6db; }
hr { border: none; border-top: 1px solid #d4c9ba; margin: 2em 0; }
ul, ol { padding-left: 2em; }
li { margin: .3em 0; }
.cover { text-align: center; padding-top: 180px; }
.cover h1 { border: none; color: #1a1612; font-size: 2.4em; letter-spacing: .04em; }
.cover .cover-label { font-family: "EB Garamond", serif; font-size: .7em; letter-spacing: .35em; text-transform: uppercase; color: #8a7e70; margin-bottom: 2em; }
.cover .meta { font-family: "EB Garamond", serif; color: #8a7e70; margin-top: 1.5em; font-size: .9em; letter-spacing: .08em; }
.cover .cover-rule { width: 40px; height: 1px; background: #c4553a; margin: 1.5em auto; }
.page-header { font-family: "EB Garamond", serif; color: #8a7e70; font-size: .8em; margin-bottom: .3em; letter-spacing: .05em; text-transform: uppercase; }
.page-source { color: #b0a596; font-size: .75em; margin-top: 2.5em; border-top: 1px solid #d4c9ba; padding-top: .6em; }
.toc { background: #eee8de; border-radius: 8px; padding: 24px 32px; margin: 1em 0; }
.toc h2 { font-family: "Noto Serif SC", serif; border: none; margin-top: 0; color: #2a2420; }
.toc ul { list-style: none; padding-left: 0; }
.toc li { margin: .2em 0; }
.toc li li { padding-left: 1.5em; }
.toc a { color: #c4553a; text-decoration: none; }
.pdf-footer { border-top: 1px solid #d4c9ba; margin-top: 3em; padding-top: 1.2em; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.pdf-footer-left { display: flex; flex-direction: column; gap: 3px; }
.pdf-footer-brand { font-family: "EB Garamond", serif; font-size: .8em; color: #8a7e70; letter-spacing: .08em; }
.pdf-footer-made { font-family: "EB Garamond", "Noto Serif SC", serif; font-size: .7em; color: #d4c9ba; letter-spacing: .04em; }
.pdf-footer-link { flex-shrink: 0; }
.pdf-footer-link a { font-family: "EB Garamond", serif; font-size: .75em; color: #c4553a; text-decoration: none; letter-spacing: .04em; }
.pdf-footer-link a:hover { text-decoration: underline; }
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

  // TOC (skip for single page)
  let toc = '';
  if (pages.length > 1) {
    toc = '<div class="toc"><h2>Table of Contents</h2><ul>';
    for (const [sec, ps] of sections) {
      toc += `<li><strong>${sec}</strong><ul>`;
      for (const p of ps) toc += `<li><a href="#p-${encodeURIComponent(p.url)}">${p.title}</a></li>`;
      toc += '</ul></li>';
    }
    toc += '</ul></div>';
  }

  // Pages
  let pagesHtml = '';
  for (const p of pages) {
    const html = marked.parse(p.markdown) as string;
    // Only add h1 title if markdown doesn't already start with one
    const hasH1 = /^<h1[\s>]/i.test(html.trim());
    pagesHtml += `
      <div class="page-break"></div>
      <div class="page-header">${p.section || ''}</div>
      <div id="p-${encodeURIComponent(p.url)}">
        ${hasH1 ? '' : `<h1>${p.title}</h1>`}
        ${html}
      </div>
      <div class="page-source">${p.url}</div>
    `;
  }

  const title = pages.length === 1 ? pages[0].title : siteInfo.title;
  const isZh = /[\u4e00-\u9fff]/.test(title);
  const madeWith = isZh ? 'Made with ❤️ by 绿皮火车' : 'Made with ❤️ by Green Train Podcast';

  const cover = pages.length === 1 ? '' : `
  <div class="cover">
    <div class="cover-label">Documentation</div>
    <h1>${title}</h1>
    <div class="cover-rule"></div>
    <div class="meta">${pages.length} pages &middot; ${new Date().toISOString().split('T')[0]}</div>
    <div class="meta">Generated by NotebookLM Jetpack</div>
  </div>
  <div class="page-break"></div>`;

  const footer = `
  <div class="pdf-footer">
    <div class="pdf-footer-left">
      <span class="pdf-footer-brand">NotebookLM Jetpack</span>
      <span class="pdf-footer-made">${madeWith}</span>
    </div>
    <div class="pdf-footer-link">
      <a href="https://youtu.be/9gPTuJZRHJk" target="_blank">youtu.be/9gPTuJZRHJk</a>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>${CSS}</style>
</head>
<body>
  ${cover}
  ${toc}
  ${pagesHtml}
  ${footer}
</body>
</html>`;
}

// ── Conversation (AI chat share) → print-friendly HTML ──

export interface ConversationPdfData {
  title: string;
  platform: string;
  url: string;
  pairs: { question: string; answer: string }[];
  isZh: boolean;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Q/A role-block styling — mirrors the share-card visual language (question
// gets a red left-border panel, answer flows; uppercase EB Garamond labels).
const CONVERSATION_CSS = `
.conv-header { text-align: center; margin: .5em 0 2.6em; }
.conv-platform { font-family: "EB Garamond", serif; font-size: .8em; letter-spacing: .25em; text-transform: uppercase; color: #8a7e70; margin-bottom: .6em; }
.conv-title { font-family: "Noto Serif SC", serif; font-size: 2em; color: #1a1612; border: none; margin: 0; letter-spacing: .02em; }
.conv-rule { width: 40px; height: 1px; background: #c4553a; margin: 1.2em auto 0; }
.conv-source { font-family: "EB Garamond", serif; font-size: .72em; color: #b0a596; margin-top: .9em; word-break: break-all; }
.qa-pair { margin: 0 0 1.6em; }
.qa-role { font-family: "EB Garamond", serif; font-size: .72em; font-weight: 500; letter-spacing: .25em; text-transform: uppercase; margin: 0 0 .45em; }
.qa-role.q { color: #c4553a; }
.qa-role.a { color: #8a7e70; }
.qa-question { border-left: 2px solid #c4553a; background: #eee8de; padding: .65em 1.05em; border-radius: 0 8px 8px 0; page-break-inside: avoid; }
.qa-question > :first-child { margin-top: 0; }
.qa-question > :last-child { margin-bottom: 0; }
.qa-answer { margin-top: 1.1em; }
.qa-answer > :first-child { margin-top: 0; }
.qa-answer > :last-child { margin-bottom: 0; }
.qa-divider { border: none; border-top: 1px solid #d4c9ba; margin: 1.8em 0; }
`;

export function buildConversationHtml(data: ConversationPdfData): string {
  marked.setOptions({ gfm: true, breaks: false });
  const { title, platform, url, pairs, isZh } = data;
  const L = isZh
    ? { q: '提问', a: '回答', kind: 'AI 对话', made: 'Made with ❤️ by 绿皮火车' }
    : { q: 'Question', a: 'Answer', kind: 'AI Conversation', made: 'Made with ❤️ by Green Train Podcast' };

  const platformLabel = platform ? `${platform} · ${L.kind}` : L.kind;

  const header = `
  <div class="conv-header">
    <div class="conv-platform">${escapeHtml(platformLabel)}</div>
    <h1 class="conv-title">${escapeHtml(title || (isZh ? 'AI 对话' : 'AI Conversation'))}</h1>
    <div class="conv-rule"></div>
    ${url ? `<div class="conv-source">${escapeHtml(url)}</div>` : ''}
  </div>`;

  const pairsHtml = pairs.map((p, i) => {
    const q = p.question?.trim()
      ? `<div class="qa-role q">${L.q}</div><div class="qa-question">${marked.parse(p.question) as string}</div>`
      : '';
    const a = p.answer?.trim()
      ? `<div class="qa-role a">${L.a}</div><div class="qa-answer">${marked.parse(p.answer) as string}</div>`
      : '';
    const divider = i < pairs.length - 1 ? '<hr class="qa-divider">' : '';
    return `<div class="qa-pair">${q}${a}</div>${divider}`;
  }).join('\n');

  const footer = `
  <div class="pdf-footer">
    <div class="pdf-footer-left">
      <span class="pdf-footer-brand">NotebookLM Jetpack</span>
      <span class="pdf-footer-made">${L.made}</span>
    </div>
    <div class="pdf-footer-link">
      <a href="https://youtu.be/9gPTuJZRHJk" target="_blank">youtu.be/9gPTuJZRHJk</a>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="${isZh ? 'zh' : 'en'}">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <style>${CSS}${CONVERSATION_CSS}</style>
</head>
<body>
  ${header}
  ${pairsHtml}
  ${footer}
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
