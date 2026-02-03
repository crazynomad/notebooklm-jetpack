import { CHANNEL_CONFIG, CACHE_CONFIG, YOUTUBE_API_CONFIG } from '@/lib/config';
import type { SubscriptionStatus, PlaylistItem } from '@/lib/types';

// Get OAuth token using chrome.identity
async function getAuthToken(interactive: boolean = true): Promise<string> {
  return new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else if (token) {
        resolve(token);
      } else {
        reject(new Error('Failed to get auth token'));
      }
    });
  });
}

// Remove cached auth token (for re-authentication)
async function removeCachedToken(token: string): Promise<void> {
  return new Promise((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, resolve);
  });
}

// Check if user is subscribed to the channel
export async function checkSubscription(): Promise<SubscriptionStatus> {
  try {
    const token = await getAuthToken();

    const response = await fetch(
      `${YOUTUBE_API_CONFIG.baseUrl}/subscriptions?part=snippet&mine=true&forChannelId=${CHANNEL_CONFIG.id}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!response.ok) {
      // Token might be expired, try to refresh
      if (response.status === 401) {
        await removeCachedToken(token);
        return checkSubscription();
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const isSubscribed = data.items && data.items.length > 0;

    const status: SubscriptionStatus = {
      isSubscribed,
      checkedAt: Date.now(),
      channelTitle: isSubscribed ? data.items[0].snippet.title : undefined,
    };

    // Cache the result
    await chrome.storage.local.set({
      [CACHE_CONFIG.subscriptionCacheKey]: status,
    });

    return status;
  } catch (error) {
    console.error('Failed to check subscription:', error);
    throw error;
  }
}

// Get cached subscription status
export async function getCachedSubscription(): Promise<SubscriptionStatus | null> {
  const result = await chrome.storage.local.get(CACHE_CONFIG.subscriptionCacheKey);
  const status = result[CACHE_CONFIG.subscriptionCacheKey] as SubscriptionStatus | undefined;

  if (!status) return null;

  // Check if cache is still valid
  const isExpired = Date.now() - status.checkedAt > CACHE_CONFIG.subscriptionCacheDuration;
  if (isExpired) return null;

  return status;
}

// Get videos from a YouTube playlist
export async function getPlaylistVideos(playlistId: string): Promise<PlaylistItem[]> {
  const token = await getAuthToken();
  const videos: PlaylistItem[] = [];
  let nextPageToken: string | undefined;

  do {
    const url = new URL(`${YOUTUBE_API_CONFIG.baseUrl}/playlistItems`);
    url.searchParams.set('part', 'snippet');
    url.searchParams.set('playlistId', playlistId);
    url.searchParams.set('maxResults', '50');
    if (nextPageToken) {
      url.searchParams.set('pageToken', nextPageToken);
    }

    const response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch playlist: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.items) {
      videos.push({
        videoId: item.snippet.resourceId.videoId,
        title: item.snippet.title,
        thumbnail: item.snippet.thumbnails?.default?.url,
      });
    }

    nextPageToken = data.nextPageToken;
  } while (nextPageToken);

  return videos;
}

// Clear subscription cache (for testing/debugging)
export async function clearSubscriptionCache(): Promise<void> {
  await chrome.storage.local.remove(CACHE_CONFIG.subscriptionCacheKey);
}
