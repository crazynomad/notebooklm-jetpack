// Data Export/Import service — backup and restore user data

const EXPORT_VERSION = 1;
const EXPORTABLE_KEYS = ['nlm_bookmarks', 'nlm_import_history'];

export interface ExportData {
  version: number;
  exportedAt: number;
  extensionVersion: string;
  data: Record<string, unknown>;
}

/** Export all user data as JSON string */
export async function exportUserData(): Promise<string> {
  const result = await chrome.storage.local.get(EXPORTABLE_KEYS);
  const exportData: ExportData = {
    version: EXPORT_VERSION,
    exportedAt: Date.now(),
    extensionVersion: chrome.runtime.getManifest().version,
    data: result,
  };
  return JSON.stringify(exportData, null, 2);
}

/** Import user data from JSON string, returns count of imported keys */
export async function importUserData(jsonStr: string): Promise<{ importedKeys: string[] }> {
  const parsed = JSON.parse(jsonStr) as ExportData;

  if (!parsed.version || !parsed.data) {
    throw new Error('Invalid export file format');
  }

  // Only import known keys
  const toImport: Record<string, unknown> = {};
  const importedKeys: string[] = [];

  for (const key of EXPORTABLE_KEYS) {
    if (parsed.data[key] !== undefined) {
      toImport[key] = parsed.data[key];
      importedKeys.push(key);
    }
  }

  if (importedKeys.length === 0) {
    throw new Error('No importable data found');
  }

  await chrome.storage.local.set(toImport);
  return { importedKeys };
}
