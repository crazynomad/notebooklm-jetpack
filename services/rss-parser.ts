import type { RssFeedItem } from '@/lib/types';
import { ensureOffscreen, sendOffscreenMessage } from '@/services/offscreen';

// Parse RSS/Atom feed and extract article links
// XML parsing is delegated to the offscreen document because
// DOMParser is not available in the MV3 service worker.
export async function parseRssFeed(feedUrl: string): Promise<RssFeedItem[]> {
  try {
    const response = await fetch(feedUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch RSS feed: ${response.status}`);
    }

    const xml = await response.text();
    await ensureOffscreen();
    const result = await sendOffscreenMessage<{ success: true; items: RssFeedItem[] }>(
      { type: 'PARSE_RSS_XML', xml },
    );
    return result.items;
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
