// User-data backup & restore (issue #47).
//
// Serializes the user's OWN data — bookmarks/collections, import history,
// settings, selected notebook — to a versioned JSON file, and restores it with
// an explicit merge/overwrite choice. Everything here is pure except
// collectBackup/applyBackup (the two that touch chrome.storage.local), so the
// schema-validation and merge logic is unit-tested directly.
//
// Data-safety invariants (issue #47 acceptance):
//   - A blanket export of storage.local is intentionally NOT done — that would
//     drag in the transient notebook_list_cache and any future non-user keys.
//     Only the BACKUP_KEYS allowlist is touched.
//   - An import NEVER clears a key that is absent from the file. A partial or
//     corrupt backup can add/replace, but can't silently wipe existing data.
//   - A file whose schemaVersion is newer than we understand is rejected, not
//     applied blindly.

import type { BookmarkStore, BookmarkItem } from '@/services/bookmarks';
import type { HistoryItem } from '@/lib/types';

export const BACKUP_SCHEMA_VERSION = 1;
const APP_ID = 'notebooklm-jetpack';

/**
 * Allowlist of user-data storage keys. Order is stable for deterministic output.
 * Excludes the transient notebook_list_cache (re-fetchable) and selected_notebook
 * (device/session state — restoring it across devices/accounts would point
 * one-click imports at a notebook that may not exist for the new user).
 */
export const BACKUP_KEYS = [
  'nlm_bookmarks',
  'import_history',
  'jetpackSettings',
] as const;
export type BackupKey = (typeof BACKUP_KEYS)[number];

export interface BackupPayload {
  app: string;
  schemaVersion: number;
  exportedAt: number;
  data: Partial<Record<BackupKey, unknown>>;
}

export type ImportMode = 'merge' | 'overwrite';

export type ParseResult =
  | { ok: true; payload: BackupPayload }
  | { ok: false; error: string };

// ── Export ──

/** Read the allowlisted user-data keys and build an export payload. */
export async function collectBackup(): Promise<BackupPayload> {
  const stored = await chrome.storage.local.get(BACKUP_KEYS as unknown as string[]);
  const data: Partial<Record<BackupKey, unknown>> = {};
  for (const key of BACKUP_KEYS) {
    if (stored[key] !== undefined) data[key] = stored[key];
  }
  return { app: APP_ID, schemaVersion: BACKUP_SCHEMA_VERSION, exportedAt: Date.now(), data };
}

export function serializeBackup(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

/** Deterministic backup filename, e.g. notebooklm-jetpack-backup-2026-07-08.json */
export function backupFilename(exportedAt: number): string {
  const d = new Date(exportedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return `notebooklm-jetpack-backup-${stamp}.json`;
}

// ── Parse + validate (pure) ──

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/**
 * Per-key shape guard. A parseable-but-corrupt value (e.g. nlm_bookmarks as a
 * string) would otherwise be written verbatim and crash the Bookmarks/History
 * views on next load, so a value that doesn't match its expected shape makes the
 * whole import fail with a clear error rather than silently wiping data.
 */
function hasValidShape(key: BackupKey, value: unknown): boolean {
  switch (key) {
    case 'nlm_bookmarks':
      // loadStore() will call store.items.find(...), so items MUST be an array.
      return isPlainObject(value) && Array.isArray((value as { items?: unknown }).items);
    case 'import_history':
      return Array.isArray(value);
    case 'jetpackSettings':
      return isPlainObject(value);
  }
}

/** Parse and validate a backup file's text. Never touches storage. */
export function parseBackup(text: string): ParseResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'invalid-json' };
  }
  if (!isPlainObject(parsed)) {
    return { ok: false, error: 'not-an-object' };
  }
  const p = parsed;

  const version = p.schemaVersion;
  // Must be a known, whole version in [1, CURRENT]. Rejects 0/negative/fractional
  // (corrupt) and anything newer than we understand (forward-compat guard).
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    return { ok: false, error: 'missing-version' };
  }
  if (version > BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: 'version-too-new' };
  }
  if (!isPlainObject(p.data)) {
    return { ok: false, error: 'missing-data' };
  }

  // Keep only known keys; ignore anything unexpected in the file. A present-but-
  // malformed known key fails the whole import (never partially wipe/crash).
  const rawData = p.data;
  const data: Partial<Record<BackupKey, unknown>> = {};
  for (const key of BACKUP_KEYS) {
    if (rawData[key] === undefined) continue;
    if (!hasValidShape(key, rawData[key])) {
      return { ok: false, error: 'corrupt-data' };
    }
    data[key] = rawData[key];
  }
  if (Object.keys(data).length === 0) {
    return { ok: false, error: 'no-known-data' };
  }

  return {
    ok: true,
    payload: {
      app: typeof p.app === 'string' ? p.app : APP_ID,
      schemaVersion: version,
      exportedAt: typeof p.exportedAt === 'number' ? p.exportedAt : 0,
      data,
    },
  };
}

// ── Merge helpers (pure) ──

function normalizeBookmarkStore(v: unknown): BookmarkStore {
  if (v && typeof v === 'object' && Array.isArray((v as BookmarkStore).items)) {
    const s = v as BookmarkStore;
    return { items: s.items, collections: Array.isArray(s.collections) ? s.collections : [] };
  }
  return { items: [], collections: [] };
}

/**
 * Merge bookmark stores. Items dedupe by url (same page saved on two devices →
 * one entry) with EXISTING winning on conflict, so a re-import can't mutate the
 * current device's entries. Collections are unioned.
 */
export function mergeBookmarks(existing: unknown, incoming: unknown): BookmarkStore {
  const e = normalizeBookmarkStore(existing);
  const i = normalizeBookmarkStore(incoming);
  const byUrl = new Map<string, BookmarkItem>();
  for (const item of i.items) if (item && item.url) byUrl.set(item.url, item);
  for (const item of e.items) if (item && item.url) byUrl.set(item.url, item); // existing overrides
  const collections = Array.from(new Set([...i.collections, ...e.collections]));
  return { items: Array.from(byUrl.values()), collections };
}

/**
 * Merge import history: union by id, most-recent first. NOT capped — a restore
 * is a deliberate recovery action, so trimming here (the history service caps
 * new imports at 100, but that must not delete the user's existing entries
 * during a merge) would silently drop data the user asked to keep.
 */
export function mergeHistory(existing: unknown, incoming: unknown): HistoryItem[] {
  const e = Array.isArray(existing) ? (existing as HistoryItem[]) : [];
  const i = Array.isArray(incoming) ? (incoming as HistoryItem[]) : [];
  const byId = new Map<string, HistoryItem>();
  for (const item of i) if (item && item.id) byId.set(item.id, item);
  for (const item of e) if (item && item.id) byId.set(item.id, item); // existing overrides
  return Array.from(byId.values()).sort((a, b) => (b.importedAt || 0) - (a.importedAt || 0));
}

/** Merge settings: existing device settings win; import only fills missing keys. */
export function mergeSettings(existing: unknown, incoming: unknown): Record<string, unknown> {
  const e = existing && typeof existing === 'object' ? (existing as Record<string, unknown>) : {};
  const i = incoming && typeof incoming === 'object' ? (incoming as Record<string, unknown>) : {};
  return { ...i, ...e };
}

// ── Apply (touches storage) ──

/**
 * Apply an imported backup.
 *   - overwrite: replace each imported key wholesale.
 *   - merge: fold the backup's new items into existing data (see merge helpers).
 * Keys absent from the import are NEVER written, so a partial backup can't wipe
 * data. Callers should reject the payload via parseBackup() first (shape guard).
 * Returns the number of user records restored (bookmarks + history + settings),
 * for a meaningful "imported N items" message — not the storage-key count.
 */
export async function applyBackup(payload: BackupPayload, mode: ImportMode): Promise<number> {
  const data = payload.data;
  const toWrite: Record<string, unknown> = {};

  if (mode === 'overwrite') {
    for (const key of BACKUP_KEYS) {
      if (data[key] !== undefined) toWrite[key] = data[key];
    }
  } else {
    const existing = await chrome.storage.local.get(BACKUP_KEYS as unknown as string[]);
    for (const key of BACKUP_KEYS) {
      if (data[key] === undefined) continue;
      switch (key) {
        case 'nlm_bookmarks':
          toWrite[key] = mergeBookmarks(existing[key], data[key]);
          break;
        case 'import_history':
          toWrite[key] = mergeHistory(existing[key], data[key]);
          break;
        case 'jetpackSettings':
          toWrite[key] = mergeSettings(existing[key], data[key]);
          break;
      }
    }
  }

  if (Object.keys(toWrite).length > 0) {
    await chrome.storage.local.set(toWrite);
  }

  // Count restored user records for the success message.
  let records = 0;
  const bm = toWrite['nlm_bookmarks'] as { items?: unknown[] } | undefined;
  if (bm && Array.isArray(bm.items)) records += bm.items.length;
  const hist = toWrite['import_history'];
  if (Array.isArray(hist)) records += hist.length;
  if (toWrite['jetpackSettings'] !== undefined) records += 1;
  return records;
}
