import type { RssFeedItem } from '@/lib/types';

// Parse RSS/Atom feed and extract article links
export async function parseRssFeed(feedUrl: string): Promise<RssFeedItem[]> {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }

    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/xml');

    // Check for parser errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      throw new Error('Invalid RSS/XML format');
    }

    const items: RssFeedItem[] = [];

    // Try RSS 2.0 format first
    const rssItems = doc.querySelectorAll('item');
    if (rssItems.length > 0) {
      rssItems.forEach((item) => {
        const link = item.querySelector('link')?.textContent;
        const title = item.querySelector('title')?.textContent;
        const pubDate = item.querySelector('pubDate')?.textContent;

        if (link) {
          items.push({
            url: link.trim(),
            title: title?.trim() || link,
            pubDate: pubDate?.trim(),
          });
        }
      });
      return items;
    }

    // Try Atom format
    const atomEntries = doc.querySelectorAll('entry');
    if (atomEntries.length > 0) {
      atomEntries.forEach((entry) => {
        // Atom links can have different rel attributes
        const linkEl =
          entry.querySelector('link[rel="alternate"]') || entry.querySelector('link');
        const link = linkEl?.getAttribute('href');
        const title = entry.querySelector('title')?.textContent;
        const published =
          entry.querySelector('published')?.textContent ||
          entry.querySelector('updated')?.textContent;

        if (link) {
          items.push({
            url: link.trim(),
            title: title?.trim() || link,
            pubDate: published?.trim(),
          });
        }
      });
      return items;
    }

    throw new Error('No items found in feed');
  } catch (error) {
    console.error('Failed to parse RSS feed:', error);
    throw error;
  }
}

// Validate if a URL looks like an RSS feed
export function isLikelyRssUrl(url: string): boolean {
  const rssPatterns = [/\.rss$/i, /\.xml$/i, /\/feed\/?$/i, /\/rss\/?$/i, /\/atom\/?$/i];

  return rssPatterns.some((pattern) => pattern.test(url));
}
