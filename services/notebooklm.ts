import { NOTEBOOKLM_CONFIG } from '@/lib/config';
import { delay } from '@/lib/utils';
import type { ImportItem, ImportProgress } from '@/lib/types';
import { addToHistory } from './history';

// Send message to content script to import a URL
async function sendImportMessage(tabId: number, url: string): Promise<boolean> {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'IMPORT_URL', url }, (response) => {
      if (chrome.runtime.lastError) {
        console.error('Content script error:', chrome.runtime.lastError);
        resolve(false);
      } else {
        resolve(response?.success ?? false);
      }
    });
  });
}

// Find or create NotebookLM tab
async function getNotebookLMTab(): Promise<chrome.tabs.Tab> {
  // Look for existing NotebookLM tab
  const tabs = await chrome.tabs.query({ url: `${NOTEBOOKLM_CONFIG.baseUrl}/*` });

  if (tabs.length > 0 && tabs[0].id) {
    // Focus existing tab
    await chrome.tabs.update(tabs[0].id, { active: true });
    return tabs[0];
  }

  // Create new tab
  const newTab = await chrome.tabs.create({ url: NOTEBOOKLM_CONFIG.baseUrl });

  // Wait for tab to load
  await new Promise<void>((resolve) => {
    const listener = (tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
      if (tabId === newTab.id && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  // Give it a bit more time to fully initialize
  await delay(1000);

  return newTab;
}

// Import a single URL to NotebookLM
export async function importUrl(url: string): Promise<boolean> {
  try {
    const tab = await getNotebookLMTab();
    if (!tab.id) throw new Error('Failed to get NotebookLM tab');

    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-scripts/notebooklm.js'],
      });
    } catch {
      // Script might already be injected
    }

    await delay(500);
    const success = await sendImportMessage(tab.id, url);

    // Record to history
    await addToHistory(url, success ? 'success' : 'error', undefined, success ? undefined : 'Import failed');

    return success;
  } catch (error) {
    console.error('Failed to import URL:', error);
    // Record failure to history
    await addToHistory(url, 'error', undefined, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
}

// Import multiple URLs with progress callback
export async function importBatch(
  urls: string[],
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportProgress> {
  const items: ImportItem[] = urls.map((url) => ({
    url,
    status: 'pending',
  }));

  const progress: ImportProgress = {
    total: urls.length,
    completed: 0,
    items,
  };

  // Get NotebookLM tab first
  const tab = await getNotebookLMTab();
  if (!tab.id) throw new Error('Failed to get NotebookLM tab');

  // Ensure content script is injected
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content-scripts/notebooklm.js'],
    });
  } catch {
    // Script might already be injected
  }

  await delay(500);

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    item.status = 'importing';
    progress.current = item;
    onProgress?.(progress);

    try {
      const success = await sendImportMessage(tab.id, item.url);
      item.status = success ? 'success' : 'error';
      if (!success) {
        item.error = 'Import failed';
      }
      // Record to history
      await addToHistory(item.url, item.status, undefined, item.error);
    } catch (error) {
      item.status = 'error';
      item.error = error instanceof Error ? error.message : 'Unknown error';
      // Record to history
      await addToHistory(item.url, 'error', undefined, item.error);
    }

    progress.completed++;
    onProgress?.(progress);

    // Add delay between imports to avoid rate limiting
    if (i < items.length - 1) {
      await delay(NOTEBOOKLM_CONFIG.importDelay);
    }
  }

  progress.current = undefined;
  return progress;
}

// Get current tab URL
export async function getCurrentTabUrl(): Promise<string | null> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url || null;
}

// Get all open tab URLs
export async function getAllTabUrls(): Promise<string[]> {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  return tabs
    .map((tab) => tab.url)
    .filter((url): url is string => !!url && url.startsWith('http'));
}
