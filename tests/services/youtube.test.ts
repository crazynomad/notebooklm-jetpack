import { describe, it, expect } from 'vitest';
import { isYouTubeUrl, parseYouTubeUrl } from '@/services/youtube';

describe('youtube', () => {
  describe('isYouTubeUrl', () => {
    it('matches youtube.com URLs', () => {
      expect(isYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe(true);
      expect(isYouTubeUrl('https://youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe(true);
      expect(isYouTubeUrl('https://m.youtube.com/watch?v=abc123')).toBe(true);
    });

    it('matches youtu.be URLs', () => {
      expect(isYouTubeUrl('https://youtu.be/dQw4w9WgXcQ')).toBe(true);
    });

    it('rejects non-YouTube URLs', () => {
      expect(isYouTubeUrl('https://example.com')).toBe(false);
      expect(isYouTubeUrl('https://podcasts.apple.com/us/podcast/id123')).toBe(false);
      expect(isYouTubeUrl('https://vimeo.com/12345')).toBe(false);
    });
  });

  describe('parseYouTubeUrl', () => {
    // Single video
    it('parses standard watch URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ'))
        .toEqual({ type: 'video', id: 'dQw4w9WgXcQ' });
    });

    it('parses youtu.be short URL', () => {
      expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ'))
        .toEqual({ type: 'video', id: 'dQw4w9WgXcQ' });
    });

    it('parses youtu.be with timestamp', () => {
      expect(parseYouTubeUrl('https://youtu.be/dQw4w9WgXcQ?t=120'))
        .toEqual({ type: 'video', id: 'dQw4w9WgXcQ' });
    });

    it('parses shorts URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/shorts/abc123'))
        .toEqual({ type: 'video', id: 'abc123' });
    });

    it('parses live URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/live/abc123'))
        .toEqual({ type: 'video', id: 'abc123' });
    });

    it('parses mobile URL', () => {
      expect(parseYouTubeUrl('https://m.youtube.com/watch?v=abc123'))
        .toEqual({ type: 'video', id: 'abc123' });
    });

    // Playlist
    it('parses playlist URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'))
        .toEqual({ type: 'playlist', id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf' });
    });

    it('parses watch URL with list param as playlist', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/watch?v=abc123&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf'))
        .toEqual({ type: 'playlist', id: 'PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf' });
    });

    it('parses UU-prefixed playlist (channel uploads)', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/playlist?list=UUxxxxxxxx'))
        .toEqual({ type: 'playlist', id: 'UUxxxxxxxx' });
    });

    // Channel
    it('parses @username channel URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/@GoogleDeepMind'))
        .toEqual({ type: 'channel', id: '@GoogleDeepMind' });
    });

    it('parses /channel/UCxxx URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx'))
        .toEqual({ type: 'channel', id: 'UCxxxxxxxxxxxxxxxxxxxxxx' });
    });

    it('parses /c/customname URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/c/Google'))
        .toEqual({ type: 'channel', id: '/c/Google' });
    });

    it('parses /user/username URL', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/user/Google'))
        .toEqual({ type: 'channel', id: '/user/Google' });
    });

    it('parses channel URL with subpath', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/@GoogleDeepMind/videos'))
        .toEqual({ type: 'channel', id: '@GoogleDeepMind' });
    });

    // Unknown
    it('returns unknown for non-YouTube URL', () => {
      expect(parseYouTubeUrl('https://example.com'))
        .toEqual({ type: 'unknown', id: '' });
    });

    it('returns unknown for YouTube homepage', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/'))
        .toEqual({ type: 'unknown', id: '' });
    });

    it('returns unknown for invalid URL', () => {
      expect(parseYouTubeUrl('not-a-url'))
        .toEqual({ type: 'unknown', id: '' });
    });

    it('handles watch URL without v param', () => {
      expect(parseYouTubeUrl('https://www.youtube.com/watch'))
        .toEqual({ type: 'unknown', id: '' });
    });
  });
});
