import { describe, it, expect } from 'vitest';
import {
  extractYouTubeVideoId,
  extractYouTubePlaylistId,
  isYouTubeUrl,
  isValidUrl,
} from '@/lib/utils';

describe('extractYouTubeVideoId', () => {
  it('extracts from standard watch URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from short URL', () => {
    expect(extractYouTubeVideoId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from embed URL', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts from shorts URL', () => {
    expect(extractYouTubeVideoId('https://youtube.com/shorts/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
  });

  it('extracts with extra params', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=120')).toBe('dQw4w9WgXcQ');
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractYouTubeVideoId('https://example.com/video')).toBeNull();
  });

  it('returns null for YouTube homepage', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/')).toBeNull();
  });
});

describe('extractYouTubePlaylistId', () => {
  it('extracts from playlist URL', () => {
    expect(extractYouTubePlaylistId('https://www.youtube.com/playlist?list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  });

  it('extracts from watch URL with playlist', () => {
    expect(extractYouTubePlaylistId('https://www.youtube.com/watch?v=abc&list=PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf')).toBe('PLrAXtmErZgOeiKm4sgNOknGvNjby9efdf');
  });

  it('returns null when no list param', () => {
    expect(extractYouTubePlaylistId('https://www.youtube.com/watch?v=abc')).toBeNull();
  });
});

describe('isYouTubeUrl', () => {
  it('returns true for youtube.com', () => {
    expect(isYouTubeUrl('https://www.youtube.com/watch?v=abc')).toBe(true);
  });

  it('returns true for youtu.be', () => {
    expect(isYouTubeUrl('https://youtu.be/abc')).toBe(true);
  });

  it('returns true for http', () => {
    expect(isYouTubeUrl('http://youtube.com/watch?v=abc')).toBe(true);
  });

  it('returns false for other domains', () => {
    expect(isYouTubeUrl('https://vimeo.com/12345')).toBe(false);
  });

  it('returns false for non-URLs', () => {
    expect(isYouTubeUrl('not a url')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('returns true for https URLs', () => {
    expect(isValidUrl('https://example.com')).toBe(true);
  });

  it('returns true for http URLs', () => {
    expect(isValidUrl('http://example.com')).toBe(true);
  });

  it('returns false for ftp', () => {
    expect(isValidUrl('ftp://example.com')).toBe(false);
  });

  it('returns false for non-URLs', () => {
    expect(isValidUrl('not a url')).toBe(false);
  });

  it('returns false for empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('returns true for URLs with paths and params', () => {
    expect(isValidUrl('https://example.com/path?q=1&b=2#hash')).toBe(true);
  });
});
