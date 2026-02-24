import { describe, it, expect } from 'vitest';
import { isValidUrl } from '@/lib/utils';

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
