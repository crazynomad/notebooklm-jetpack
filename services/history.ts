import type { HistoryItem } from '@/lib/types';

const STORAGE_KEY = 'import_history';
const MAX_HISTORY_ITEMS = 100;

// Generate a unique ID
function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

// Get import history
export async function getHistory(limit?: number): Promise<HistoryItem[]> {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  const history: HistoryItem[] = result[STORAGE_KEY] || [];

  if (limit && limit > 0) {
    return history.slice(0, limit);
  }
  return history;
}

// Add an item to history
export async function addToHistory(
  url: string,
  status: 'success' | 'error',
  title?: string,
  error?: string
): Promise<void> {
  const history = await getHistory();

  const newItem: HistoryItem = {
    id: generateId(),
    url,
    title,
    importedAt: Date.now(),
    status,
    error,
  };

  // Add to beginning of array
  history.unshift(newItem);

  // Trim to max size
  if (history.length > MAX_HISTORY_ITEMS) {
    history.splice(MAX_HISTORY_ITEMS);
  }

  await chrome.storage.local.set({ [STORAGE_KEY]: history });
}

// Clear all history
export async function clearHistory(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEY);
}
