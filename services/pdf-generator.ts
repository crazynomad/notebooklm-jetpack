/**
 * PDF Generator Service
 *
 * Fetches documentation pages and generates a structured PDF
 * with table of contents, suitable for NotebookLM import.
 *
 * Uses pdfmake for pure client-side PDF generation.
 */

import pdfMake from 'pdfmake/build/pdfmake';
import type { TDocumentDefinitions, Content, ContentText, ContentColumns } from 'pdfmake/interfaces';
import type { DocPageItem, DocSiteInfo } from '@/lib/types';

// Embed standard fonts (Roboto) - pdfmake requires explicit font setup
// In browser extension context, we use the bundled vfs_fonts
import 'pdfmake/build/vfs_fonts';

// ─── Types ─────────────────────────────────────────────────────

export interface PdfGeneratorOptions {
  /** Max concurrent fetches */
  concurrency?: number;
  /** Max pages to include (for large sites) */
  maxPages?: number;
  /** Max words per PDF volume (NotebookLM limit ~500k) */
  maxWordsPerVolume?: number;
  /** Progress callback */
  onProgress?: (progress: PdfProgress) => void;
}

export interface PdfProgress {
  phase: 'fetching' | 'generating' | 'done';
  current: number;
  total: number;
  currentPage?: string;
}

export interface PdfVolume {
  filename: string;
  blob: Blob;
  pageCount: number;
  wordCount: number;
  sections: string[];
}

// ─── HTML → Plain Text ─────────────────────────────────────────

/** Strip HTML tags and decode entities, return plain text */
function htmlToPlainText(html: string): string {
  // Create a temporary element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.trim() || '';
}

/** Extract readable content from an HTML page */
function extractContent(html: string, url: string): { title: string; text: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Try common main content selectors
  const selectors = [
    'article',
    'main',
    '[role="main"]',
    '.markdown-body',
    '.content',
    '.documentation',
    '#content',
    '.prose',
    '.article-content',
    '.page-content',
  ];

  let contentEl: Element | null = null;
  for (const sel of selectors) {
    contentEl = doc.querySelector(sel);
    if (contentEl) break;
  }

  if (!contentEl) {
    contentEl = doc.body;
  }

  // Remove scripts, styles, navs, footers
  const removals = contentEl.querySelectorAll(
    'script, style, nav, footer, header, .sidebar, .nav, .toc, .breadcrumb, .pagination'
  );
  removals.forEach((el) => el.remove());

  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || url;

  // Convert to structured text preserving headings
  const lines: string[] = [];
  const walker = doc.createTreeWalker(contentEl, NodeFilter.SHOW_ELEMENT);

  let node: Node | null = walker.currentNode;
  while (node) {
    if (node instanceof HTMLElement) {
      const tag = node.tagName.toLowerCase();
      if (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tag)) {
        const text = node.textContent?.trim();
        if (text) {
          const level = parseInt(tag[1]);
          lines.push('\n' + '#'.repeat(level) + ' ' + text + '\n');
        }
      } else if (['p', 'li', 'td', 'th', 'dd', 'dt', 'blockquote'].includes(tag)) {
        const text = node.textContent?.trim();
        if (text) {
          const prefix = tag === 'li' ? '• ' : tag === 'blockquote' ? '> ' : '';
          lines.push(prefix + text);
        }
      } else if (tag === 'pre' || tag === 'code') {
        const text = node.textContent?.trim();
        if (text && tag === 'pre') {
          lines.push('\n```\n' + text + '\n```\n');
        }
      }
    }
    node = walker.nextNode();
  }

  // Fallback to plain text if structured extraction yields little
  let text = lines.join('\n');
  if (text.length < 100) {
    text = contentEl.textContent?.trim() || '';
  }

  return { title, text };
}

// ─── Fetch Pages ───────────────────────────────────────────────

interface PageContent {
  url: string;
  title: string;
  text: string;
  section?: string;
  wordCount: number;
}

async function fetchPage(page: DocPageItem): Promise<PageContent | null> {
  try {
    const response = await fetch(page.url, {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) return null;

    const html = await response.text();
    const { title, text } = extractContent(html, page.url);

    return {
      url: page.url,
      title: title || page.title,
      text,
      section: page.section,
      wordCount: text.split(/\s+/).length,
    };
  } catch {
    return null;
  }
}

async function fetchAllPages(
  pages: DocPageItem[],
  options: PdfGeneratorOptions
): Promise<PageContent[]> {
  const concurrency = options.concurrency || 5;
  const results: PageContent[] = [];
  let completed = 0;

  // Process in batches
  for (let i = 0; i < pages.length; i += concurrency) {
    const batch = pages.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fetchPage));

    for (const result of batchResults) {
      if (result && result.text.length > 50) {
        results.push(result);
      }
      completed++;
      options.onProgress?.({
        phase: 'fetching',
        current: completed,
        total: pages.length,
        currentPage: batch[0]?.title,
      });
    }
  }

  return results;
}

// ─── Build PDF Document ────────────────────────────────────────

function buildPdfContent(
  siteInfo: DocSiteInfo,
  pages: PageContent[],
  volumeIndex?: number,
  totalVolumes?: number
): TDocumentDefinitions {
  const content: Content[] = [];

  // Title page
  const volumeLabel =
    totalVolumes && totalVolumes > 1 ? ` (Vol. ${(volumeIndex || 0) + 1}/${totalVolumes})` : '';

  content.push({
    text: siteInfo.title + volumeLabel,
    style: 'title',
    alignment: 'center',
    margin: [0, 100, 0, 10],
  } as ContentText);

  content.push({
    text: siteInfo.baseUrl,
    style: 'subtitle',
    alignment: 'center',
    margin: [0, 0, 0, 10],
    color: '#666666',
  } as ContentText);

  content.push({
    text: `${pages.length} pages · Generated ${new Date().toISOString().split('T')[0]}`,
    alignment: 'center',
    margin: [0, 0, 0, 40],
    color: '#999999',
    fontSize: 10,
  } as ContentText);

  // Table of Contents header
  content.push({
    text: 'Table of Contents',
    style: 'h1',
    pageBreak: 'before',
    margin: [0, 0, 0, 20],
  } as ContentText);

  // Group pages by section
  const sections = new Map<string, PageContent[]>();
  for (const page of pages) {
    const section = page.section || 'General';
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(page);
  }

  // TOC entries
  for (const [section, sectionPages] of sections) {
    content.push({
      text: section,
      style: 'tocSection',
      margin: [0, 8, 0, 4],
    } as ContentText);

    for (const page of sectionPages) {
      content.push({
        columns: [
          { text: page.title, width: '*', style: 'tocItem' },
        ],
        margin: [10, 1, 0, 1],
      } as ContentColumns);
    }
  }

  // Page content
  for (const [section, sectionPages] of sections) {
    // Section header
    content.push({
      text: section,
      style: 'sectionHeader',
      pageBreak: 'before',
      margin: [0, 0, 0, 20],
    } as ContentText);

    for (const page of sectionPages) {
      // Page title
      content.push({
        text: page.title,
        style: 'h2',
        margin: [0, 15, 0, 5],
      } as ContentText);

      // Source URL
      content.push({
        text: page.url,
        style: 'sourceUrl',
        margin: [0, 0, 0, 10],
        color: '#888888',
        fontSize: 8,
      } as ContentText);

      // Page content - split by lines for proper formatting
      const lines = page.text.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;

        if (line.startsWith('# ')) {
          content.push({ text: line.slice(2), style: 'h2', margin: [0, 10, 0, 5] } as ContentText);
        } else if (line.startsWith('## ')) {
          content.push({ text: line.slice(3), style: 'h3', margin: [0, 8, 0, 4] } as ContentText);
        } else if (line.startsWith('### ')) {
          content.push({ text: line.slice(4), style: 'h4', margin: [0, 6, 0, 3] } as ContentText);
        } else if (line.startsWith('```')) {
          // Code block - handled as preformatted
          content.push({
            text: line,
            style: 'code',
            margin: [10, 2, 10, 2],
          } as ContentText);
        } else if (line.startsWith('• ')) {
          content.push({
            text: line,
            style: 'listItem',
            margin: [15, 1, 0, 1],
          } as ContentText);
        } else if (line.startsWith('> ')) {
          content.push({
            text: line.slice(2),
            style: 'blockquote',
            margin: [20, 2, 20, 2],
          } as ContentText);
        } else {
          content.push({
            text: line,
            style: 'body',
            margin: [0, 2, 0, 2],
          } as ContentText);
        }
      }

      // Separator between pages
      content.push({
        canvas: [{ type: 'line', x1: 0, y1: 5, x2: 515, y2: 5, lineWidth: 0.5, lineColor: '#DDDDDD' }],
        margin: [0, 10, 0, 5],
      });
    }
  }

  return {
    info: {
      title: siteInfo.title + volumeLabel,
      author: 'NotebookLM Importer',
      subject: `Documentation from ${siteInfo.baseUrl}`,
    },
    content,
    styles: {
      title: { fontSize: 24, bold: true },
      subtitle: { fontSize: 14 },
      h1: { fontSize: 20, bold: true },
      h2: { fontSize: 16, bold: true },
      h3: { fontSize: 14, bold: true },
      h4: { fontSize: 12, bold: true },
      sectionHeader: { fontSize: 22, bold: true, color: '#333333' },
      tocSection: { fontSize: 13, bold: true, color: '#333333' },
      tocItem: { fontSize: 10, color: '#555555' },
      body: { fontSize: 10, lineHeight: 1.4 },
      code: { fontSize: 9, font: 'Courier', background: '#f5f5f5' },
      listItem: { fontSize: 10, lineHeight: 1.3 },
      blockquote: { fontSize: 10, italics: true, color: '#555555' },
      sourceUrl: { fontSize: 8 },
    },
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
    },
    pageSize: 'A4',
    pageMargins: [40, 40, 40, 40],
    footer: (currentPage: number, pageCount: number) => ({
      text: `${siteInfo.title} — Page ${currentPage} of ${pageCount}`,
      alignment: 'center' as const,
      fontSize: 8,
      color: '#AAAAAA',
      margin: [0, 10, 0, 0],
    }),
  };
}

// ─── Split into Volumes ────────────────────────────────────────

function splitIntoVolumes(
  pages: PageContent[],
  maxWords: number
): PageContent[][] {
  const volumes: PageContent[][] = [];
  let current: PageContent[] = [];
  let currentWords = 0;

  // Group by section first to keep related pages together
  const sections = new Map<string, PageContent[]>();
  for (const page of pages) {
    const section = page.section || 'General';
    if (!sections.has(section)) sections.set(section, []);
    sections.get(section)!.push(page);
  }

  for (const [, sectionPages] of sections) {
    const sectionWords = sectionPages.reduce((sum, p) => sum + p.wordCount, 0);

    // If adding this section exceeds limit, start new volume
    if (currentWords > 0 && currentWords + sectionWords > maxWords) {
      volumes.push(current);
      current = [];
      currentWords = 0;
    }

    current.push(...sectionPages);
    currentWords += sectionWords;
  }

  if (current.length > 0) {
    volumes.push(current);
  }

  return volumes;
}

// ─── Public API ────────────────────────────────────────────────

/**
 * Generate PDF(s) from a documentation site.
 * Returns one or more PDF volumes if the site exceeds size limits.
 */
export async function generateDocsPdf(
  siteInfo: DocSiteInfo,
  options: PdfGeneratorOptions = {}
): Promise<PdfVolume[]> {
  const maxPages = options.maxPages || 500;
  const maxWords = options.maxWordsPerVolume || 400000; // Stay under 500k limit

  // Limit pages
  const pagesToFetch = siteInfo.pages.slice(0, maxPages);

  // Fetch all page contents
  const contents = await fetchAllPages(pagesToFetch, options);

  if (contents.length === 0) {
    throw new Error('No page content could be fetched');
  }

  // Split into volumes if needed
  const volumePages = splitIntoVolumes(contents, maxWords);
  const volumes: PdfVolume[] = [];

  for (let i = 0; i < volumePages.length; i++) {
    const pages = volumePages[i];

    options.onProgress?.({
      phase: 'generating',
      current: i + 1,
      total: volumePages.length,
    });

    const docDef = buildPdfContent(siteInfo, pages, i, volumePages.length);

    // Generate PDF blob
    const blob = await new Promise<Blob>((resolve) => {
      const pdfDoc = pdfMake.createPdf(docDef);
      // pdfmake types are incomplete; getBlob accepts a callback
      (pdfDoc as unknown as { getBlob: (cb: (b: Blob) => void) => void }).getBlob((b) => resolve(b));
    });

    const sections = [...new Set(pages.map((p) => p.section || 'General'))];
    const sanitizedTitle = siteInfo.title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '-');
    const suffix = volumePages.length > 1 ? `-vol${i + 1}` : '';

    volumes.push({
      filename: `${sanitizedTitle}${suffix}.pdf`,
      blob,
      pageCount: pages.length,
      wordCount: pages.reduce((sum, p) => sum + p.wordCount, 0),
      sections,
    });
  }

  options.onProgress?.({
    phase: 'done',
    current: volumes.length,
    total: volumes.length,
  });

  return volumes;
}

/** Download a PDF volume to the user's downloads */
export function downloadPdfVolume(volume: PdfVolume): void {
  const url = URL.createObjectURL(volume.blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = volume.filename;
  a.click();
  URL.revokeObjectURL(url);
}
