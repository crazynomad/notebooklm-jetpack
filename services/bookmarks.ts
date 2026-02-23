// Bookmark/Collection service — "Read Later" with PDF aggregation

export interface BookmarkItem {
  id: string;
  url: string;
  title: string;
  favicon?: string;
  collection: string;
  addedAt: number;
}

export interface BookmarkStore {
  items: BookmarkItem[];
  collections: string[];
}

const STORAGE_KEY = 'nlm_bookmarks';
const DEFAULT_COLLECTION = '默认收藏';

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function loadStore(): Promise<BookmarkStore> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const store = result[STORAGE_KEY] as BookmarkStore | undefined;
  return store || { items: [], collections: [DEFAULT_COLLECTION] };
}

async function saveStore(store: BookmarkStore): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEY]: store });
}

/** Add a bookmark */
export async function addBookmark(
  url: string,
  title: string,
  favicon?: string,
  collection?: string
): Promise<BookmarkItem> {
  const store = await loadStore();

  // Dedup: don't add same URL twice
  const existing = store.items.find((b) => b.url === url);
  if (existing) return existing;

  const col = collection || DEFAULT_COLLECTION;
  if (!store.collections.includes(col)) {
    store.collections.push(col);
  }

  const item: BookmarkItem = {
    id: generateId(),
    url,
    title,
    favicon,
    collection: col,
    addedAt: Date.now(),
  };

  store.items.unshift(item); // newest first
  await saveStore(store);
  return item;
}

/** Remove a bookmark by ID */
export async function removeBookmark(id: string): Promise<void> {
  const store = await loadStore();
  store.items = store.items.filter((b) => b.id !== id);
  await saveStore(store);
}

/** Remove multiple bookmarks */
export async function removeBookmarks(ids: string[]): Promise<void> {
  const store = await loadStore();
  const idSet = new Set(ids);
  store.items = store.items.filter((b) => !idSet.has(b.id));
  await saveStore(store);
}

/** Get all bookmarks */
export async function getBookmarks(): Promise<BookmarkItem[]> {
  const store = await loadStore();
  return store.items;
}

/** Get bookmarks by collection */
export async function getBookmarksByCollection(collection: string): Promise<BookmarkItem[]> {
  const store = await loadStore();
  return store.items.filter((b) => b.collection === collection);
}

/** Get all collection names */
export async function getCollections(): Promise<string[]> {
  const store = await loadStore();
  return store.collections;
}

/** Create a new collection */
export async function createCollection(name: string): Promise<void> {
  const store = await loadStore();
  if (!store.collections.includes(name)) {
    store.collections.push(name);
    await saveStore(store);
  }
}

/** Delete a collection (moves its items to default) */
export async function deleteCollection(name: string): Promise<void> {
  if (name === DEFAULT_COLLECTION) return;
  const store = await loadStore();
  store.collections = store.collections.filter((c) => c !== name);
  store.items.forEach((b) => {
    if (b.collection === name) b.collection = DEFAULT_COLLECTION;
  });
  await saveStore(store);
}

/** Move bookmark to another collection */
export async function moveBookmark(id: string, collection: string): Promise<void> {
  const store = await loadStore();
  const item = store.items.find((b) => b.id === id);
  if (item) {
    item.collection = collection;
    if (!store.collections.includes(collection)) {
      store.collections.push(collection);
    }
    await saveStore(store);
  }
}

/** Check if a URL is bookmarked */
export async function isBookmarked(url: string): Promise<boolean> {
  const store = await loadStore();
  return store.items.some((b) => b.url === url);
}
