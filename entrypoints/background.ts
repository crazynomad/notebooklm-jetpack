import {
  checkSubscription,
  getCachedSubscription,
  getPlaylistVideos,
} from '@/services/youtube-api';
import { parseRssFeed } from '@/services/rss-parser';
import {
  importUrl,
  importBatch,
  getCurrentTabUrl,
  getAllTabUrls,
} from '@/services/notebooklm';
import { analyzeDocSite } from '@/services/docs-site';
import { extractYouTubePlaylistId } from '@/lib/utils';
import type { MessageType, MessageResponse, DocSiteInfo } from '@/lib/types';

export default defineBackground(() => {
  console.log('NotebookLM Importer background service started');

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

    default:
      throw new Error('Unknown message type');
  }
}
