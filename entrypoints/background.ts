import {
  checkSubscription,
  getCachedSubscription,
  getPlaylistVideos,
} from '@/services/youtube-api';
import { parseRssFeed } from '@/services/rss-parser';
import {
  importUrl,
  importBatch,
  importText,
  getCurrentTabUrl,
  getAllTabUrls,
} from '@/services/notebooklm';
import { analyzeDocSite } from '@/services/docs-site';
import { getHistory, clearHistory } from '@/services/history';
import {
  extractClaudeConversation,
  formatConversationForImport,
} from '@/services/claude-conversation';
import { extractYouTubePlaylistId } from '@/lib/utils';
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

    showNotification('正在导入...', url.slice(0, 50) + (url.length > 50 ? '...' : ''));

    try {
      const success = await importUrl(url);
      if (success) {
        showNotification('导入成功', '页面已添加到 NotebookLM');
      } else {
        showNotification('导入失败', '请确保 NotebookLM 已打开并选择了笔记本');
      }
    } catch (error) {
      showNotification('导入失败', error instanceof Error ? error.message : '未知错误');
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

// Show a notification
function showNotification(title: string, message: string) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: chrome.runtime.getURL('icons/icon-128.png'),
    title,
    message,
  });
}

async function handleMessage(message: MessageType): Promise<unknown> {
  switch (message.type) {
    case 'CHECK_SUBSCRIPTION':
      return await checkSubscription();

    case 'GET_CACHED_SUBSCRIPTION':
      return await getCachedSubscription();

    case 'IMPORT_URL':
      return await importUrl(message.url);

    case 'IMPORT_BATCH':
      return await importBatch(message.urls);

    case 'GET_PLAYLIST_VIDEOS': {
      const playlistId = extractYouTubePlaylistId(message.playlistUrl);
      if (!playlistId) {
        throw new Error('Invalid playlist URL');
      }
      return await getPlaylistVideos(playlistId);
    }

    case 'PARSE_RSS':
      return await parseRssFeed(message.rssUrl);

    case 'GET_CURRENT_TAB':
      return await getCurrentTabUrl();

    case 'GET_ALL_TABS':
      return await getAllTabUrls();

    case 'ANALYZE_DOC_SITE':
      return await analyzeDocSite(message.tabId);

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
