import type { DocSiteInfo } from '@/lib/types';
import { delay } from '@/lib/utils';

// Analyze a document site by injecting content script
export async function analyzeDocSite(tabId: number): Promise<DocSiteInfo> {
  // Inject the docs content script
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content-scripts/docs.js'],
    });
  } catch (error) {
    // Script might already be injected, or tab might not be accessible
    console.warn('Script injection warning:', error);
  }

  // Give the script time to initialize
  await delay(300);

  // Send message to content script to analyze the page
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: 'ANALYZE_DOC_SITE_INTERNAL' },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message || 'Failed to communicate with tab'));
          return;
        }

        if (!response) {
          reject(new Error('No response from content script'));
          return;
        }

        if (response.success) {
          resolve(response.data as DocSiteInfo);
        } else {
          reject(new Error(response.error || 'Analysis failed'));
        }
      }
    );
  });
}
