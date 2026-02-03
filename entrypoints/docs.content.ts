// Content script for document site analysis (dynamically injected)
import { analyzeDocSite } from '@/services/docs-analyzer';
import type { DocSiteInfo } from '@/lib/types';

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',
  // This content script is programmatically injected, not auto-loaded
  registration: 'runtime',

  main() {
    console.log('NotebookLM Importer: docs analyzer content script loaded');

    // Listen for analyze messages from background script
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message.type === 'ANALYZE_DOC_SITE_INTERNAL') {
        try {
          const baseUrl = window.location.href;
          const result: DocSiteInfo = analyzeDocSite(document, baseUrl);
          sendResponse({ success: true, data: result });
        } catch (error) {
          console.error('Doc site analysis error:', error);
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Analysis failed',
          });
        }
        return true;
      }
    });
  },
});
