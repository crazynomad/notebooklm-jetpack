import { describe, it, expect, beforeEach } from 'vitest';
import { resetStorage } from '../setup';
import {
  addBookmark,
  removeBookmark,
  removeBookmarks,
  getBookmarks,
  getBookmarksByCollection,
  getCollections,
  createCollection,
  deleteCollection,
  moveBookmark,
  isBookmarked,
} from '@/services/bookmarks';

describe('bookmarks', () => {
  beforeEach(() => {
    resetStorage();
  });

  describe('addBookmark', () => {
    it('adds a bookmark and returns it', async () => {
      const item = await addBookmark('https://example.com', 'Example');
      expect(item.url).toBe('https://example.com');
      expect(item.title).toBe('Example');
      expect(item.collection).toBe('默认收藏');
      expect(item.id).toBeTruthy();
    });

    it('deduplicates by URL', async () => {
      const first = await addBookmark('https://example.com', 'Example');
      const second = await addBookmark('https://example.com', 'Example 2');
      expect(second.id).toBe(first.id);
      expect(second.title).toBe('Example'); // keeps original
    });

    it('adds to custom collection', async () => {
      const item = await addBookmark('https://a.com', 'A', undefined, 'My Collection');
      expect(item.collection).toBe('My Collection');
      const cols = await getCollections();
      expect(cols).toContain('My Collection');
    });

    it('stores favicon', async () => {
      const item = await addBookmark('https://a.com', 'A', 'https://a.com/favicon.ico');
      expect(item.favicon).toBe('https://a.com/favicon.ico');
    });
  });

  describe('removeBookmark', () => {
    it('removes a bookmark by id', async () => {
      const item = await addBookmark('https://a.com', 'A');
      await removeBookmark(item.id);
      const all = await getBookmarks();
      expect(all).toHaveLength(0);
    });

    it('ignores non-existent id', async () => {
      await addBookmark('https://a.com', 'A');
      await removeBookmark('non-existent');
      const all = await getBookmarks();
      expect(all).toHaveLength(1);
    });
  });

  describe('removeBookmarks', () => {
    it('removes multiple bookmarks', async () => {
      const a = await addBookmark('https://a.com', 'A');
      const b = await addBookmark('https://b.com', 'B');
      await addBookmark('https://c.com', 'C');
      await removeBookmarks([a.id, b.id]);
      const all = await getBookmarks();
      expect(all).toHaveLength(1);
      expect(all[0].url).toBe('https://c.com');
    });
  });

  describe('getBookmarks', () => {
    it('returns empty array initially', async () => {
      expect(await getBookmarks()).toEqual([]);
    });

    it('returns newest first', async () => {
      await addBookmark('https://a.com', 'A');
      await addBookmark('https://b.com', 'B');
      const all = await getBookmarks();
      expect(all[0].url).toBe('https://b.com');
      expect(all[1].url).toBe('https://a.com');
    });
  });

  describe('getBookmarksByCollection', () => {
    it('filters by collection', async () => {
      await addBookmark('https://a.com', 'A', undefined, 'Col1');
      await addBookmark('https://b.com', 'B', undefined, 'Col2');
      await addBookmark('https://c.com', 'C', undefined, 'Col1');
      const col1 = await getBookmarksByCollection('Col1');
      expect(col1).toHaveLength(2);
      expect(col1.every((b) => b.collection === 'Col1')).toBe(true);
    });
  });

  describe('getCollections', () => {
    it('returns default collection initially', async () => {
      const cols = await getCollections();
      expect(cols).toContain('默认收藏');
    });
  });

  describe('createCollection', () => {
    it('creates a new collection', async () => {
      await createCollection('Research');
      const cols = await getCollections();
      expect(cols).toContain('Research');
    });

    it('does not duplicate existing collection', async () => {
      await createCollection('Research');
      await createCollection('Research');
      const cols = await getCollections();
      expect(cols.filter((c) => c === 'Research')).toHaveLength(1);
    });
  });

  describe('deleteCollection', () => {
    it('moves items to default collection', async () => {
      await addBookmark('https://a.com', 'A', undefined, 'Temp');
      await deleteCollection('Temp');
      const all = await getBookmarks();
      expect(all[0].collection).toBe('默认收藏');
      const cols = await getCollections();
      expect(cols).not.toContain('Temp');
    });

    it('does not delete default collection', async () => {
      await deleteCollection('默认收藏');
      const cols = await getCollections();
      expect(cols).toContain('默认收藏');
    });
  });

  describe('moveBookmark', () => {
    it('moves bookmark to another collection', async () => {
      const item = await addBookmark('https://a.com', 'A');
      await moveBookmark(item.id, 'New Col');
      const all = await getBookmarks();
      expect(all[0].collection).toBe('New Col');
    });

    it('creates collection if it does not exist', async () => {
      const item = await addBookmark('https://a.com', 'A');
      await moveBookmark(item.id, 'Auto Created');
      const cols = await getCollections();
      expect(cols).toContain('Auto Created');
    });

    it('ignores non-existent bookmark id', async () => {
      await moveBookmark('non-existent', 'Col');
      // Should not throw
    });
  });

  describe('isBookmarked', () => {
    it('returns true for bookmarked URL', async () => {
      await addBookmark('https://a.com', 'A');
      expect(await isBookmarked('https://a.com')).toBe(true);
    });

    it('returns false for non-bookmarked URL', async () => {
      expect(await isBookmarked('https://z.com')).toBe(false);
    });
  });
});
