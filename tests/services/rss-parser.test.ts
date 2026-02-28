import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isLikelyRssUrl, parseRssFeed } from '@/services/rss-parser';

// Mock the offscreen module so tests don't need real Chrome offscreen APIs.
// The offscreen document uses DOMParser internally — in tests we simulate
// its message-based contract directly.
vi.mock('@/services/offscreen', () => ({
  ensureOffscreen: vi.fn().mockResolvedValue(undefined),
  sendOffscreenMessage: vi.fn(),
}));

import { sendOffscreenMessage } from '@/services/offscreen';
const mockSendOffscreen = vi.mocked(sendOffscreenMessage);

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
  beforeEach(() => {
    mockSendOffscreen.mockReset();
  });

  it('parses RSS 2.0 feed via offscreen', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<rss>...</rss>'),
    });

    // Simulate offscreen returning parsed items
    mockSendOffscreen.mockResolvedValue({
      success: true,
      items: [
        { url: 'https://example.com/post-1', title: 'First Post', pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT' },
        { url: 'https://example.com/post-2', title: 'Second Post' },
      ],
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

    // Verify the XML was sent to offscreen
    expect(mockSendOffscreen).toHaveBeenCalledWith({
      type: 'PARSE_RSS_XML',
      xml: '<rss>...</rss>',
    });
  });

  it('parses Atom feed via offscreen', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<feed>...</feed>'),
    });

    mockSendOffscreen.mockResolvedValue({
      success: true,
      items: [
        { url: 'https://example.com/atom-1', title: 'Atom Post', pubDate: '2024-01-01T00:00:00Z' },
      ],
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

  it('throws on invalid XML (offscreen rejects)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('not xml at all'),
    });

    mockSendOffscreen.mockRejectedValue(new Error('Invalid RSS/XML format'));

    await expect(parseRssFeed('https://example.com/bad.xml')).rejects.toThrow();
  });
});
