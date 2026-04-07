/**
 * YouTube service.
 * Extracts video URLs from YouTube videos, playlists, and channels
 * for batch import into NotebookLM (which natively parses YouTube URLs).
 *
 * Supports:
 *   - Single video: youtube.com/watch?v=, youtu.be/, youtube.com/shorts/
 *   - Playlist: youtube.com/playlist?list=, youtube.com/watch?v=...&list=
 *   - Channel: youtube.com/@username, youtube.com/channel/UCxxx
 *
 * Uses InnerTube API (primary for playlists) and RSS feeds (primary for channels, fallback for playlists).
 */

import type { YouTubeVideoItem, YouTubeSourceInfo, YouTubeResult } from '@/lib/types';

// ── URL Parsing ──

export type YouTubeUrlType = 'video' | 'playlist' | 'channel' | 'unknown';

export function isYouTubeUrl(url: string): boolean {
  return /(?:youtube\.com|youtu\.be)\//.test(url);
}

export function parseYouTubeUrl(url: string): { type: YouTubeUrlType; id: string } {
  try {
    // Normalize mobile URLs
    const normalized = url.replace('m.youtube.com', 'www.youtube.com');
    const urlObj = new URL(normalized);
    const hostname = urlObj.hostname.replace('www.', '');

    // youtu.be short links → single video
    if (hostname === 'youtu.be') {
      const id = urlObj.pathname.slice(1).split('/')[0];
      return id ? { type: 'video', id } : { type: 'unknown', id: '' };
    }

    if (hostname !== 'youtube.com') return { type: 'unknown', id: '' };

    const pathname = urlObj.pathname;

    // Playlist takes priority when list= param is present (even on watch pages)
    const listId = urlObj.searchParams.get('list');
    if (listId && (pathname === '/playlist' || pathname.startsWith('/playlist') || urlObj.searchParams.has('v'))) {
      if (pathname === '/playlist' || listId.startsWith('PL') || listId.startsWith('UU') || listId.startsWith('OL')) {
        return { type: 'playlist', id: listId };
      }
    }

    // Standalone playlist page
    if (pathname.startsWith('/playlist')) {
      if (listId) return { type: 'playlist', id: listId };
    }

    // Single video: /watch?v= or /shorts/
    if (pathname === '/watch') {
      const videoId = urlObj.searchParams.get('v');
      return videoId ? { type: 'video', id: videoId } : { type: 'unknown', id: '' };
    }
    if (pathname.startsWith('/shorts/')) {
      const id = pathname.split('/shorts/')[1]?.split(/[?/]/)[0];
      return id ? { type: 'video', id } : { type: 'unknown', id: '' };
    }
    if (pathname.startsWith('/live/')) {
      const id = pathname.split('/live/')[1]?.split(/[?/]/)[0];
      return id ? { type: 'video', id } : { type: 'unknown', id: '' };
    }

    // Channel: /@username, /channel/UCxxx, /c/name, /user/name
    if (pathname.startsWith('/@')) {
      const handle = pathname.split('/')[1]; // /@username
      return { type: 'channel', id: handle };
    }
    if (pathname.startsWith('/channel/')) {
      const channelId = pathname.split('/channel/')[1]?.split('/')[0];
      return channelId ? { type: 'channel', id: channelId } : { type: 'unknown', id: '' };
    }
    if (pathname.startsWith('/c/')) {
      const customName = pathname.split('/c/')[1]?.split('/')[0];
      return customName ? { type: 'channel', id: `/c/${customName}` } : { type: 'unknown', id: '' };
    }
    if (pathname.startsWith('/user/')) {
      const username = pathname.split('/user/')[1]?.split('/')[0];
      return username ? { type: 'channel', id: `/user/${username}` } : { type: 'unknown', id: '' };
    }

    return { type: 'unknown', id: '' };
  } catch {
    return { type: 'unknown', id: '' };
  }
}

// ── Fetch Entry Point ──

const FETCH_TIMEOUT = 15000;

const INNERTUBE_CLIENT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240101.00.00',
    hl: 'en',
  },
};

export async function fetchYouTube(url: string): Promise<YouTubeResult> {
  const parsed = parseYouTubeUrl(url);

  switch (parsed.type) {
    case 'video':
      return await fetchSingleVideo(parsed.id);
    case 'playlist':
      return await fetchPlaylistVideos(parsed.id);
    case 'channel':
      return await fetchChannelVideos(parsed.id);
    default:
      throw new Error('Unrecognized YouTube URL');
  }
}

/** Load more videos using a continuation token (works for both playlist and channel). */
export async function fetchYouTubeMore(continuation: string): Promise<{
  videos: YouTubeVideoItem[];
  continuation?: string;
}> {
  const resp = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: INNERTUBE_CLIENT, continuation }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!resp.ok) throw new Error(`InnerTube continuation failed: ${resp.status}`);
  const data = await resp.json();
  return extractContinuationItems(data);
}

// ── Single Video ──

async function fetchSingleVideo(videoId: string): Promise<YouTubeResult> {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  let title = videoId;

  try {
    const resp = await fetch(videoUrl, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT),
      headers: { 'Accept-Language': 'en-US,en;q=0.9' },
    });
    const html = await resp.text();
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    if (titleMatch?.[1]) {
      title = titleMatch[1].replace(/ - YouTube$/, '').trim();
    }
  } catch {
    // Use videoId as fallback title
  }

  return {
    source: { type: 'video', id: videoId, title, videoCount: 1 },
    videos: [{ id: videoId, url: videoUrl, title }],
  };
}

// ── Playlist ──

async function fetchPlaylistVideos(playlistId: string): Promise<YouTubeResult> {
  // Try InnerTube API first
  try {
    return await fetchPlaylistViaInnerTube(playlistId);
  } catch (innerTubeError) {
    console.warn('[YouTube] InnerTube failed for playlist, trying RSS:', innerTubeError);
  }

  // Fallback to RSS (no pagination)
  return await fetchPlaylistViaRss(playlistId);
}

async function fetchPlaylistViaInnerTube(playlistId: string): Promise<YouTubeResult> {
  const resp = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ context: INNERTUBE_CLIENT, browseId: `VL${playlistId}` }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!resp.ok) throw new Error(`InnerTube browse failed: ${resp.status}`);
  const data = await resp.json();

  const playlistTitle = extractPlaylistTitle(data) || playlistId;
  const { videos, continuation } = extractPlaylistItems(data);

  return {
    source: {
      type: 'playlist',
      id: playlistId,
      title: playlistTitle,
      videoCount: videos.length,
    },
    videos,
    continuation,
  };
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function extractPlaylistTitle(data: any): string | undefined {
  try {
    return (
      data?.header?.playlistHeaderRenderer?.title?.simpleText ||
      data?.metadata?.playlistMetadataRenderer?.title
    );
  } catch {
    return undefined;
  }
}

function extractPlaylistItems(data: any): {
  videos: YouTubeVideoItem[];
  continuation?: string;
} {
  const videos: YouTubeVideoItem[] = [];
  let continuation: string | undefined;

  try {
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
    const contents = tabs?.[0]?.tabRenderer?.content?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents?.[0]?.playlistVideoListRenderer?.contents;

    if (!Array.isArray(contents)) return { videos };

    for (const item of contents) {
      if (item.playlistVideoRenderer) {
        const renderer = item.playlistVideoRenderer;
        const videoId = renderer.videoId;
        if (!videoId) continue;
        const title = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || videoId;
        videos.push({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title,
        });
      }
      if (item.continuationItemRenderer) {
        continuation = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      }
    }
  } catch {
    // Parse error — return whatever we got
  }

  return { videos, continuation };
}

function extractContinuationItems(data: any): {
  videos: YouTubeVideoItem[];
  continuation?: string;
} {
  const videos: YouTubeVideoItem[] = [];
  let continuation: string | undefined;

  try {
    const actions = data?.onResponseReceivedActions;
    const contents = actions?.[0]?.appendContinuationItemsAction?.continuationItems;

    if (!Array.isArray(contents)) return { videos };

    for (const item of contents) {
      const renderer = item.playlistVideoRenderer || item.richItemRenderer?.content?.videoRenderer;
      if (renderer) {
        const videoId = renderer.videoId;
        if (!videoId) continue;
        const title = renderer.title?.runs?.[0]?.text || renderer.title?.simpleText || videoId;
        videos.push({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title,
        });
      }
      if (item.continuationItemRenderer) {
        continuation = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      }
    }
  } catch {
    // Parse error
  }

  return { videos, continuation };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function fetchPlaylistViaRss(playlistId: string): Promise<YouTubeResult> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;
  const resp = await fetch(rssUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!resp.ok) throw new Error(`RSS feed fetch failed: ${resp.status}`);
  const xml = await resp.text();

  const { title, videos } = parseYouTubeRss(xml);

  return {
    source: {
      type: 'playlist',
      id: playlistId,
      title: title || playlistId,
      videoCount: videos.length,
    },
    videos,
  };
}

// ── Channel ──

/** Protobuf-encoded params for the "Videos" tab sorted by latest. */
const CHANNEL_VIDEOS_TAB_PARAMS = 'EgZ2aWRlb3PyBgQKAjoA';

async function fetchChannelVideos(channelIdentifier: string): Promise<YouTubeResult> {
  const channelId = await resolveChannelId(channelIdentifier);

  // Try InnerTube first
  try {
    return await fetchChannelViaInnerTube(channelId, channelIdentifier);
  } catch (innerTubeError) {
    console.warn('[YouTube] InnerTube failed for channel, trying RSS:', innerTubeError);
  }

  // Fallback to RSS (no pagination, max 15 items)
  return await fetchChannelViaRss(channelId, channelIdentifier);
}

async function fetchChannelViaInnerTube(
  channelId: string,
  channelIdentifier: string,
): Promise<YouTubeResult> {
  const resp = await fetch('https://www.youtube.com/youtubei/v1/browse?prettyPrint=false', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      context: INNERTUBE_CLIENT,
      browseId: channelId,
      params: CHANNEL_VIDEOS_TAB_PARAMS,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
  });

  if (!resp.ok) throw new Error(`InnerTube channel browse failed: ${resp.status}`);
  const data = await resp.json();

  const channelTitle = extractChannelTitle(data) || channelIdentifier;
  const { videos, continuation } = extractChannelVideoItems(data);

  if (videos.length === 0) {
    throw new Error('No videos found via InnerTube, falling back to RSS');
  }

  return {
    source: {
      type: 'channel',
      id: channelId,
      title: channelTitle,
      videoCount: videos.length,
    },
    videos,
    continuation,
  };
}

function extractChannelTitle(data: any): string | undefined {
  try {
    return (
      data?.metadata?.channelMetadataRenderer?.title ||
      data?.header?.c4TabbedHeaderRenderer?.title
    );
  } catch {
    return undefined;
  }
}

function extractChannelVideoItems(data: any): {
  videos: YouTubeVideoItem[];
  continuation?: string;
} {
  const videos: YouTubeVideoItem[] = [];
  let continuation: string | undefined;

  try {
    // Navigate to the Videos tab content
    const tabs = data?.contents?.twoColumnBrowseResultsRenderer?.tabs;
    let tabContents: any[] | undefined;

    for (const tab of tabs || []) {
      const renderer = tab.tabRenderer;
      if (!renderer) continue;
      // The Videos tab contains richGridRenderer
      const richGrid = renderer.content?.richGridRenderer?.contents;
      if (richGrid) {
        tabContents = richGrid;
        break;
      }
    }

    if (!tabContents) return { videos };

    for (const item of tabContents) {
      const videoRenderer = item.richItemRenderer?.content?.videoRenderer;
      if (videoRenderer) {
        const videoId = videoRenderer.videoId;
        if (!videoId) continue;
        const title = videoRenderer.title?.runs?.[0]?.text || videoId;
        videos.push({
          id: videoId,
          url: `https://www.youtube.com/watch?v=${videoId}`,
          title,
        });
      }
      if (item.continuationItemRenderer) {
        continuation = item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      }
    }
  } catch {
    // Parse error
  }

  return { videos, continuation };
}

async function fetchChannelViaRss(
  channelId: string,
  channelIdentifier: string,
): Promise<YouTubeResult> {
  const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const resp = await fetch(rssUrl, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!resp.ok) throw new Error(`Channel RSS feed failed: ${resp.status}`);
  const xml = await resp.text();

  const { title, videos } = parseYouTubeRss(xml);

  return {
    source: {
      type: 'channel',
      id: channelId,
      title: title || channelIdentifier,
      videoCount: videos.length,
    },
    videos,
  };
}

async function resolveChannelId(identifier: string): Promise<string> {
  // Already a channel ID (starts with UC)
  if (identifier.startsWith('UC') && identifier.length > 20) {
    return identifier;
  }

  // Need to resolve: @username, /c/name, /user/name
  let pageUrl: string;
  if (identifier.startsWith('@')) {
    pageUrl = `https://www.youtube.com/${identifier}`;
  } else if (identifier.startsWith('/c/') || identifier.startsWith('/user/')) {
    pageUrl = `https://www.youtube.com${identifier}`;
  } else {
    pageUrl = `https://www.youtube.com/@${identifier}`;
  }

  const resp = await fetch(pageUrl, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT),
    headers: { 'Accept-Language': 'en-US,en;q=0.9' },
  });
  if (!resp.ok) throw new Error(`Failed to resolve channel: ${resp.status}`);
  const html = await resp.text();

  const channelIdMatch = html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/)
    || html.match(/"externalId":"(UC[a-zA-Z0-9_-]+)"/)
    || html.match(/channel_id=(UC[a-zA-Z0-9_-]+)/);

  if (!channelIdMatch?.[1]) {
    throw new Error('Could not resolve channel ID');
  }

  return channelIdMatch[1];
}

// ── RSS Parsing ──

function parseYouTubeRss(xml: string): {
  title: string;
  videos: YouTubeVideoItem[];
} {
  const videos: YouTubeVideoItem[] = [];

  const feedTitleMatch = xml.match(/<feed[^>]*>[\s\S]*?<title>([^<]*)<\/title>/);
  const title = feedTitleMatch?.[1] || '';

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;
  while ((match = entryRegex.exec(xml)) !== null) {
    const entry = match[1];
    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
    const titleMatch = entry.match(/<media:title>([^<]*)<\/media:title>/)
      || entry.match(/<title>([^<]*)<\/title>/);
    const publishedMatch = entry.match(/<published>([^<]*)<\/published>/);

    if (videoIdMatch?.[1]) {
      const videoId = videoIdMatch[1];
      videos.push({
        id: videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: titleMatch?.[1] || videoId,
        publishedAt: publishedMatch?.[1]?.split('T')[0],
      });
    }
  }

  return { title, videos };
}
