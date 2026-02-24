import { describe, it, expect } from 'vitest';
import {
  isApplePodcastUrl,
  parseApplePodcastUrl,
} from '@/services/podcast';

describe('podcast', () => {
  describe('isApplePodcastUrl', () => {
    it('matches Apple Podcasts URLs', () => {
      expect(isApplePodcastUrl('https://podcasts.apple.com/us/podcast/example/id12345')).toBe(true);
      expect(isApplePodcastUrl('https://podcasts.apple.com/cn/podcast/test/id99999?i=100')).toBe(true);
    });

    it('rejects non-Apple URLs', () => {
      expect(isApplePodcastUrl('https://example.com')).toBe(false);
      expect(isApplePodcastUrl('https://xiaoyuzhoufm.com/episode/abc')).toBe(false);
    });
  });

  describe('parseApplePodcastUrl', () => {
    it('extracts podcast ID', () => {
      const result = parseApplePodcastUrl('https://podcasts.apple.com/us/podcast/my-show/id12345');
      expect(result.podcastId).toBe('12345');
      expect(result.episodeId).toBeNull();
      expect(result.country).toBe('us');
    });

    it('extracts episode ID from query param', () => {
      const result = parseApplePodcastUrl('https://podcasts.apple.com/cn/podcast/show/id12345?i=99999');
      expect(result.podcastId).toBe('12345');
      expect(result.episodeId).toBe('99999');
      expect(result.country).toBe('cn');
    });

    it('defaults country to us', () => {
      const result = parseApplePodcastUrl('https://podcasts.apple.com/podcast/show/id12345');
      expect(result.country).toBe('us');
    });

    it('handles URL with no id', () => {
      const result = parseApplePodcastUrl('https://podcasts.apple.com/us/podcast/show');
      expect(result.podcastId).toBeNull();
    });
  });
});
