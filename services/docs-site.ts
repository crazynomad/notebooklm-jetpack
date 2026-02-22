import type { DocSiteInfo, DocPageItem } from '@/lib/types';
import { delay } from '@/lib/utils';

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
