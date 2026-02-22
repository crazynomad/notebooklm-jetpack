import type { DocSiteInfo, DocPageItem } from '@/lib/types';
import { delay } from '@/lib/utils';

// ─── llms.txt (AI-native page index) ──────────────────────────
// Standard adopted by 66%+ of doc sites (Mintlify, React, Svelte, Next.js, Angular, etc.)
// Format: "- [Title](https://domain/path.md)" or "- [Title](https://domain/path.md): Description"
// Some sites (e.g. Supabase) use llms.txt as an index pointing to sub-files (llms/guides.txt)
export async function fetchLlmsTxt(baseUrl: string): Promise<DocPageItem[]> {
  const pages: DocPageItem[] = [];
  const origin = new URL(baseUrl).origin;

  try {
    const response = await fetch(`${origin}/llms.txt`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return pages;

    const text = await response.text();
    // Must contain markdown-style links to be valid llms.txt
    if (!text.includes('](')) return pages;

    const linkPattern = /^-\s*\[([^\]]+)\]\(([^)]+)\)/gm;
    let match;
    while ((match = linkPattern.exec(text)) !== null) {
      const title = match[1].trim();
      const rawUrl = match[2].trim();
      try {
        const urlObj = new URL(rawUrl, origin);
        if (urlObj.origin !== origin) continue;
        // Strip .md suffix for the page path
        const path = urlObj.pathname.replace(/\.md$/, '');
        const url = `${origin}${path}`;
        const segments = path.split('/').filter(Boolean);
        pages.push({
          url,
          title,
          path,
          level: Math.max(0, segments.length - 1),
          section: segments[0] || undefined,
        });
      } catch { /* invalid URL */ }
    }
  } catch { /* llms.txt not available */ }

  return pages;
}

// ─── llms-full.txt (full site content in one request) ─────────
// Returns the complete text content — ideal for PDF export (no per-page fetching needed)
// Supported by ~28% of doc sites: OpenClaw, Svelte, Vue, Nuxt, Bun, VitePress, Angular, Cal.com
export async function fetchLlmsFullTxt(baseUrl: string): Promise<string | null> {
  const origin = new URL(baseUrl).origin;
  try {
    const response = await fetch(`${origin}/llms-full.txt`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    const text = await response.text();
    // Validate: should be substantial content (>1KB) and not HTML
    if (text.length < 1000 || text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return null;
    return text;
  } catch { return null; }
}

// Fetch page content via Mintlify .md suffix (URL + .md → markdown)
export async function fetchMintlifyMarkdown(pageUrl: string): Promise<string | null> {
  try {
    const mdUrl = pageUrl.replace(/\/$/, '') + '.md';
    const response = await fetch(mdUrl, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) return null;
    const text = await response.text();
    // Validate: should look like markdown, not HTML
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return null;
    return text;
  } catch { return null; }
}

// Probe if a site supports the .md suffix convention (URL.md → markdown content)
// Returns true if the site returns valid markdown when .md is appended to a page URL
export async function probeMdSuffix(pageUrl: string): Promise<boolean> {
  try {
    const mdUrl = pageUrl.replace(/\/$/, '') + '.md';
    const response = await fetch(mdUrl, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) return false;
    const text = await response.text();
    // Must look like markdown, not HTML
    if (text.startsWith('<!DOCTYPE') || text.startsWith('<html')) return false;
    // Should have some markdown indicators
    return text.includes('#') || text.includes('```') || text.includes('- ') || text.startsWith('---');
  } catch { return false; }
}

// Try to fetch and parse sitemap.xml for more reliable page discovery
export async function fetchSitemap(baseUrl: string): Promise<DocPageItem[]> {
  const pages: DocPageItem[] = [];
  const urlObj = new URL(baseUrl);
  const origin = urlObj.origin;
  const pathPrefix = urlObj.pathname.replace(/\/$/, '');

  // Check multiple possible sitemap locations
  const sitemapUrls = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap-0.xml`,
    `${origin}/sitemap_index.xml`,
  ];
  // If the URL has a subpath like /docs, also try sitemap at that path
  if (pathPrefix && pathPrefix !== '/') {
    sitemapUrls.unshift(`${origin}${pathPrefix}/sitemap.xml`);
  }

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await fetch(sitemapUrl, { signal: AbortSignal.timeout(5000) });
      if (!response.ok) continue;

      const text = await response.text();

      // Handle plain text sitemap (one URL per line, e.g. WeChat docs)
      if (!text.includes('<urlset') && !text.includes('<sitemapindex')) {
        const lines = text.trim().split('\n').filter((line) => {
          const trimmed = line.trim();
          return trimmed.startsWith('http://') || trimmed.startsWith('https://');
        });
        if (lines.length > 10) {
          for (const line of lines) {
            const url = line.trim();
            try {
              const urlObj = new URL(url);
              if (urlObj.origin !== origin) continue;
              const path = urlObj.pathname;
              const title = path
                .split('/')
                .filter(Boolean)
                .pop()
                ?.replace(/[-_]/g, ' ')
                ?.replace(/\.html?$/, '')
                ?.replace(/^\w/, (c) => c.toUpperCase()) || path;
              pages.push({ url, title, path, level: Math.max(0, path.split('/').filter(Boolean).length - 1), section: path.split('/').filter(Boolean)[0] || undefined });
            } catch { /* invalid URL */ }
          }
          if (pages.length > 0) break;
        }
        continue;
      }

      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/xml');

      // Handle sitemap index (recursive)
      const sitemaps = doc.querySelectorAll('sitemap > loc');
      if (sitemaps.length > 0) {
        for (const loc of sitemaps) {
          const subUrl = loc.textContent?.trim();
          if (!subUrl) continue;
          try {
            const subResponse = await fetch(subUrl, { signal: AbortSignal.timeout(5000) });
            if (!subResponse.ok) continue;
            const subText = await subResponse.text();
            const subDoc = parser.parseFromString(subText, 'text/xml');
            extractUrlsFromSitemap(subDoc, origin, pages);
          } catch {
            // Skip failed sub-sitemaps
          }
        }
      } else {
        extractUrlsFromSitemap(doc, origin, pages);
      }

      if (pages.length > 0) break;
    } catch {
      // Sitemap not available, continue to next
    }
  }

  return pages;
}

function extractUrlsFromSitemap(
  doc: Document,
  origin: string,
  pages: DocPageItem[]
): void {
  const urls = doc.querySelectorAll('url > loc');
  urls.forEach((loc) => {
    const url = loc.textContent?.trim();
    if (!url) return;

    // Only include same-origin URLs
    try {
      const urlObj = new URL(url);
      if (urlObj.origin !== origin) return;

      // Generate title from path
      const path = urlObj.pathname;
      const title = path
        .split('/')
        .filter(Boolean)
        .pop()
        ?.replace(/-/g, ' ')
        ?.replace(/^\w/, (c) => c.toUpperCase()) || path;

      pages.push({
        url,
        title,
        path,
        level: Math.max(0, path.split('/').filter(Boolean).length - 1),
        section: path.split('/').filter(Boolean)[0] || undefined,
      });
    } catch {
      // Invalid URL
    }
  });
}

// ─── HarmonyOS Catalog API ─────────────────────────────────────
// HarmonyOS docs are a pure Angular SPA with no SSR/sitemap.
// The catalog tree is available via a POST API.
const HUAWEI_API_BASE = 'https://svc-drcn.developer.huawei.com/community/servlet/consumer';

interface HuaweiCatalogNode {
  isLeaf: boolean;
  nodeName: string;
  relateDocument?: string;
  children?: HuaweiCatalogNode[];
}

export async function fetchHuaweiCatalog(url: string): Promise<DocPageItem[]> {
  // Extract catalogName from URL pattern: /doc/{catalogName}/{objectId}
  const match = url.match(/\/doc\/([^/]+)\/([^/?#]+)/);
  if (!match) return [];

  const catalogName = match[1]; // e.g. "harmonyos-guides-V5"

  try {
    const response = await fetch(`${HUAWEI_API_BASE}/cn/documentPortal/getCatalogTree`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        catalogName,
        objectId: match[2],
        showHide: '0',
        language: 'cn',
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) return [];

    const data = await response.json();
    const pages: DocPageItem[] = [];
    const baseUrl = 'https://developer.huawei.com/consumer/cn/doc';

    function walk(nodes: HuaweiCatalogNode[], section?: string, level = 0) {
      for (const node of nodes) {
        if (node.relateDocument) {
          const docUrl = `${baseUrl}/${catalogName}/${node.relateDocument}`;
          pages.push({
            url: docUrl,
            title: node.nodeName,
            path: `/${catalogName}/${node.relateDocument}`,
            level,
            section: section || node.nodeName,
          });
        }
        if (node.children?.length) {
          walk(node.children, section || node.nodeName, level + 1);
        }
      }
    }

    // The response is an array of root catalog nodes
    if (Array.isArray(data)) {
      walk(data);
    } else if (data?.children) {
      walk(data.children);
    }

    return pages;
  } catch (error) {
    console.error('Failed to fetch Huawei catalog:', error);
    return [];
  }
}

// Analyze a document site by injecting content script
export async function analyzeDocSite(tabId: number): Promise<DocSiteInfo> {
  // Inject the docs content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/docs.js'],
    });
  } catch (error) {
    // Script might already be injected, or tab might not be accessible
    console.warn('Script injection warning:', error);
  }

  // Give the script time to initialize
  await delay(300);

  // Send message to content script to analyze the page
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'ANALYZE_DOC_SITE_INTERNAL' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Failed to communicate with tab'));
          return;
        }

        if (!response) {
          reject(new Error('No response from content script'));
          return;
        }

        if (response.success) {
          resolve(response.data as DocSiteInfo);
        } else {
          reject(new Error(response.error || 'Analysis failed'));
        }
      }
    );
  });
}
