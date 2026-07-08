import { describe, it, expect, beforeEach } from 'vitest';
import { resetStorage, storageMock } from '../setup';
import {
  collectBackup,
  serializeBackup,
  backupFilename,
  parseBackup,
  applyBackup,
  mergeBookmarks,
  mergeHistory,
  mergeSettings,
  BACKUP_SCHEMA_VERSION,
} from '@/services/backup';

const seed = () => {
  storageMock['nlm_bookmarks'] = {
    items: [
      { id: 'a', url: 'https://x.com/1', title: 'One', collection: '默认收藏', addedAt: 1 },
    ],
    collections: ['默认收藏'],
  };
  storageMock['import_history'] = [
    { id: 'h1', url: 'https://x.com/1', importedAt: 100, status: 'success' },
  ];
  storageMock['jetpackSettings'] = { autoRenamePastedSources: false };
  // Keys that must NOT be exported: transient cache + device-only selection.
  storageMock['notebook_list_cache'] = { notebooks: [1, 2, 3], cachedAt: 1 };
  storageMock['selected_notebook'] = { id: 'nb1' };
};

describe('backup: collect + serialize', () => {
  beforeEach(() => resetStorage());

  it('exports only the allowlisted user-data keys, never cache or device selection', async () => {
    seed();
    const payload = await collectBackup();
    expect(payload.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(Object.keys(payload.data).sort()).toEqual([
      'import_history',
      'jetpackSettings',
      'nlm_bookmarks',
    ]);
    expect(payload.data).not.toHaveProperty('notebook_list_cache');
    expect(payload.data).not.toHaveProperty('selected_notebook');
  });

  it('serializes to valid JSON round-trippable via parseBackup', async () => {
    seed();
    const result = parseBackup(serializeBackup(await collectBackup()));
    expect(result.ok).toBe(true);
  });

  it('backupFilename is a dated json name', () => {
    const name = backupFilename(Date.parse('2026-07-08T12:00:00Z'));
    expect(name).toMatch(/^notebooklm-jetpack-backup-\d{4}-\d{2}-\d{2}\.json$/);
  });
});

describe('backup: parse + validate', () => {
  it('rejects non-JSON', () => {
    expect(parseBackup('not json{').ok).toBe(false);
  });
  it('rejects a JSON array (not an object)', () => {
    expect(parseBackup('[1,2,3]').ok).toBe(false);
  });
  it('rejects a missing schemaVersion', () => {
    expect(parseBackup(JSON.stringify({ data: { nlm_bookmarks: { items: [] } } })).ok).toBe(false);
  });
  it('rejects zero / negative / fractional schemaVersion (corrupt)', () => {
    for (const v of [0, -1, 1.5]) {
      expect(parseBackup(JSON.stringify({ schemaVersion: v, data: { nlm_bookmarks: { items: [] } } })).ok, `v=${v}`).toBe(false);
    }
  });
  it('rejects a schemaVersion newer than we understand', () => {
    const r = parseBackup(JSON.stringify({ schemaVersion: BACKUP_SCHEMA_VERSION + 1, data: { nlm_bookmarks: { items: [] } } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('version-too-new');
  });
  it('rejects a corrupt known key shape (nlm_bookmarks as a string) instead of applying it', () => {
    const r = parseBackup(JSON.stringify({ schemaVersion: 1, data: { nlm_bookmarks: 'oops' } }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe('corrupt-data');
  });
  it('rejects nlm_bookmarks missing its items array', () => {
    expect(parseBackup(JSON.stringify({ schemaVersion: 1, data: { nlm_bookmarks: { collections: [] } } })).ok).toBe(false);
  });
  it('rejects import_history that is not an array', () => {
    expect(parseBackup(JSON.stringify({ schemaVersion: 1, data: { import_history: { not: 'array' } } })).ok).toBe(false);
  });
  it('rejects a file with no known data keys', () => {
    expect(parseBackup(JSON.stringify({ schemaVersion: 1, data: { something_else: 1 } })).ok).toBe(false);
  });
  it('accepts a valid file and keeps only known keys', () => {
    const r = parseBackup(JSON.stringify({ schemaVersion: 1, data: { jetpackSettings: { autoRenamePastedSources: true }, junk: 9 } }));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.payload.data).toHaveProperty('jetpackSettings');
      expect(r.payload.data).not.toHaveProperty('junk');
    }
  });
});

describe('backup: merge helpers', () => {
  it('mergeBookmarks dedupes by url (existing wins) and unions collections', () => {
    const existing = { items: [{ id: 'a', url: 'https://x.com/1', title: 'Existing', collection: 'C1', addedAt: 1 }], collections: ['C1'] };
    const incoming = {
      items: [
        { id: 'b', url: 'https://x.com/1', title: 'Incoming dup', collection: 'C2', addedAt: 2 },
        { id: 'c', url: 'https://x.com/2', title: 'New', collection: 'C2', addedAt: 3 },
      ],
      collections: ['C2'],
    };
    const merged = mergeBookmarks(existing, incoming);
    expect(merged.items).toHaveLength(2);
    expect(merged.items.find((i) => i.url === 'https://x.com/1')?.title).toBe('Existing');
    expect(merged.items.some((i) => i.url === 'https://x.com/2')).toBe(true);
    expect(merged.collections.sort()).toEqual(['C1', 'C2']);
  });

  it('mergeHistory unions by id, newest first, and never drops existing entries', () => {
    const existing = [{ id: 'h1', url: 'u1', importedAt: 100, status: 'success' }];
    const incoming = Array.from({ length: 120 }, (_, n) => ({ id: `n${n}`, url: `u${n}`, importedAt: 200 + n, status: 'success' }));
    const merged = mergeHistory(existing, incoming);
    expect(merged).toHaveLength(121); // no cap — every entry survives a restore
    expect(merged[0].importedAt).toBe(319); // newest first
    expect(merged.some((h) => h.id === 'h1')).toBe(true); // existing entry preserved
  });

  it('mergeSettings lets existing device settings win', () => {
    const merged = mergeSettings({ autoRenamePastedSources: false }, { autoRenamePastedSources: true, extra: 1 });
    expect(merged.autoRenamePastedSources).toBe(false);
    expect(merged.extra).toBe(1);
  });
});

describe('backup: applyBackup', () => {
  beforeEach(() => resetStorage());

  it('overwrite replaces imported keys but never touches absent keys', async () => {
    seed();
    const before = storageMock['import_history'];
    const payload = { app: 'x', schemaVersion: 1, exportedAt: 0, data: { nlm_bookmarks: { items: [], collections: ['Fresh'] } } };
    await applyBackup(payload, 'overwrite');
    expect((storageMock['nlm_bookmarks'] as { collections: string[] }).collections).toEqual(['Fresh']);
    expect(storageMock['import_history']).toBe(before); // untouched → no wipe
  });

  it('merge preserves existing bookmarks and folds in new ones', async () => {
    seed();
    const payload = {
      app: 'x', schemaVersion: 1, exportedAt: 0,
      data: { nlm_bookmarks: { items: [{ id: 'z', url: 'https://x.com/9', title: 'Nine', collection: 'C', addedAt: 9 }], collections: ['C'] } },
    };
    await applyBackup(payload, 'merge');
    const store = storageMock['nlm_bookmarks'] as { items: { url: string }[] };
    expect(store.items.map((i) => i.url).sort()).toEqual(['https://x.com/1', 'https://x.com/9']);
  });

  it('returns the count of restored records (bookmarks + history + settings)', async () => {
    resetStorage();
    const payload = {
      app: 'x', schemaVersion: 1, exportedAt: 0,
      data: {
        nlm_bookmarks: { items: [{ id: '1', url: 'a', title: 'A', collection: 'c', addedAt: 1 }, { id: '2', url: 'b', title: 'B', collection: 'c', addedAt: 2 }], collections: ['c'] },
        import_history: [{ id: 'h', url: 'a', importedAt: 1, status: 'success' }],
        jetpackSettings: { autoRenamePastedSources: true },
      },
    };
    const count = await applyBackup(payload, 'overwrite');
    expect(count).toBe(4); // 2 bookmarks + 1 history + 1 settings
  });

  it('an empty payload writes nothing (no accidental wipe)', async () => {
    seed();
    const written = await applyBackup({ app: 'x', schemaVersion: 1, exportedAt: 0, data: {} }, 'overwrite');
    expect(written).toBe(0);
    expect(storageMock['nlm_bookmarks']).toBeDefined();
  });
});
