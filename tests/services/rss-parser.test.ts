import { describe, it, expect, vi } from 'vitest';
import { isLikelyRssUrl, parseRssFeed } from '@/services/rss-parser';

describe('isLikelyRssUrl', () => {
  it('detects .rss extension', () => {
    expect(isLikelyRssUrl('https://example.com/feed.rss')).toBe(true);
  });

  it('detects .xml extension', () => {
    expect(isLikelyRssUrl('https://example.com/feed.xml')).toBe(true);
  });

  it('detects /feed path', () => {
    expect(isLikelyRssUrl('https://example.com/feed')).toBe(true);
    expect(isLikelyRssUrl('https://example.com/feed/')).toBe(true);
  });

  it('detects /rss path', () => {
    expect(isLikelyRssUrl('https://example.com/rss')).toBe(true);
    expect(isLikelyRssUrl('https://example.com/rss/')).toBe(true);
  });

  it('detects /atom path', () => {
    expect(isLikelyRssUrl('https://example.com/atom')).toBe(true);
    expect(isLikelyRssUrl('https://example.com/atom/')).toBe(true);
  });

  it('returns false for regular URLs', () => {
    expect(isLikelyRssUrl('https://example.com/')).toBe(false);
    expect(isLikelyRssUrl('https://example.com/blog/post-1')).toBe(false);
  });
});

describe('parseRssFeed', () => {
  it('parses RSS 2.0 feed', async () => {
    const rssXml = `<?xml version="1.0" encoding="UTF-8"?>
    <rss version="2.0">
      <channel>
        <title>Test Blog</title>
        <item>
          <title>First Post</title>
          <link>https://example.com/post-1</link>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Second Post</title>
          <link>https://example.com/post-2</link>
        </item>
      </channel>
    </rss>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(rssXml),
    });

    const items = await parseRssFeed('https://example.com/feed.xml');
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      url: 'https://example.com/post-1',
      title: 'First Post',
      pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
    });
    expect(items[1].title).toBe('Second Post');
    expect(items[1].pubDate).toBeUndefined();
  });

  it('parses Atom feed', async () => {
    const atomXml = `<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Test Blog</title>
      <entry>
        <title>Atom Post</title>
        <link rel="alternate" href="https://example.com/atom-1"/>
        <published>2024-01-01T00:00:00Z</published>
      </entry>
    </feed>`;

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(atomXml),
    });

    const items = await parseRssFeed('https://example.com/atom.xml');
    expect(items).toHaveLength(1);
    expect(items[0].url).toBe('https://example.com/atom-1');
    expect(items[0].title).toBe('Atom Post');
  });

  it('throws on HTTP error', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    await expect(parseRssFeed('https://example.com/bad')).rejects.toThrow('404');
  });

  it('throws on invalid XML', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('not xml at all'),
    });

    await expect(parseRssFeed('https://example.com/bad.xml')).rejects.toThrow();
  });
});
