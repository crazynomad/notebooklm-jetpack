import { parseRssFeed } from '@/services/rss-parser';
import {
  importUrl,
  importBatch,
  importText,
  getCurrentTabUrl,
  getAllTabUrls,
} from '@/services/notebooklm';
import { analyzeDocSite, fetchSitemap } from '@/services/docs-site';
import { getHistory, clearHistory } from '@/services/history';
import {
  extractClaudeConversation,
  formatConversationForImport,
} from '@/services/claude-conversation';
import type { MessageType, MessageResponse } from '@/lib/types';

// Context menu IDs
const MENU_ID_PAGE = 'import-page';
const MENU_ID_LINK = 'import-link';

export default defineBackground(() => {
  console.log('NotebookLM Importer background service started');

  // Create context menus on install
  chrome.runtime.onInstalled.addListener(() => {
    // Menu item for importing current page
    chrome.contextMenus.create({
      id: MENU_ID_PAGE,
      title: '导入此页面到 NotebookLM',
      contexts: ['page'],
    });

    // Menu item for importing a link
    chrome.contextMenus.create({
      id: MENU_ID_LINK,
      title: '导入此链接到 NotebookLM',
      contexts: ['link'],
    });
  });

  // Handle context menu clicks
  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    let url: string | undefined;

    if (info.menuItemId === MENU_ID_PAGE) {
      url = tab?.url;
    } else if (info.menuItemId === MENU_ID_LINK) {
      url = info.linkUrl;
    }

    if (!url || !url.startsWith('http')) {
      showNotification('导入失败', '无效的 URL');
      return;
    }

    try {
      await importUrl(url);
    } catch (error) {
      console.error('Context menu import failed:', error);
    }
  });

  // Handle messages from popup and content scripts
  chrome.runtime.onMessage.addListener(
    (
      message: MessageType,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response: MessageResponse) => void
    ) => {
      handleMessage(message)
        .then((data) => sendResponse({ success: true, data }))
        .catch((error) =>
          sendResponse({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
          })
        );

      // Return true to indicate we'll send response asynchronously
      return true;
    }
  );
});

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case 'IMPORT_URL':
      return await importUrl(message.url);

    case 'IMPORT_BATCH':
      return await importBatch(message.urls);

    case 'PARSE_RSS':
      return await parseRssFeed(message.rssUrl);

    case 'GET_CURRENT_TAB':
      return await getCurrentTabUrl();

    case 'GET_ALL_TABS':
      return await getAllTabUrls();

    case 'ANALYZE_DOC_SITE': {
      // Try sitemap first (more reliable), fallback to DOM analysis
      const tabInfo = await chrome.tabs.get(message.tabId);
      const tabUrl = tabInfo.url || '';

      if (tabUrl.startsWith('http')) {
        try {
          const sitemapPages = await fetchSitemap(tabUrl);
          if (sitemapPages.length > 0) {
            const origin = new URL(tabUrl).origin;
            return {
              baseUrl: origin,
              title: tabInfo.title || new URL(tabUrl).hostname,
              framework: 'sitemap' as const,
              pages: sitemapPages,
            };
          }
        } catch {
          // Sitemap not available, fallback to DOM analysis
        }
      }

      return await analyzeDocSite(message.tabId);
    }

    case 'GET_HISTORY':
      return await getHistory(message.limit);

    case 'CLEAR_HISTORY':
      return await clearHistory();

    case 'EXTRACT_CLAUDE_CONVERSATION':
      return await extractClaudeConversation(message.tabId);

    case 'IMPORT_CLAUDE_CONVERSATION': {
      const formattedText = formatConversationForImport(
        message.conversation,
        message.selectedMessageIds
      );
      return await importText(formattedText, message.conversation.title);
    }

    default:
      throw new Error('Unknown message type');
  }
}
