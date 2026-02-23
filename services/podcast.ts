/**
 * Podcast downloader service.
 * Supports:
 *   - Apple Podcasts: iTunes API (primary) + RSS feed (fallback)
 *   - 小宇宙 (Xiaoyuzhou FM): __NEXT_DATA__ SSR extraction + RSS feed fallback
 */

export interface PodcastInfo {
  name: string;
  artist: string;
  country: string;
  artworkUrl?: string;
  feedUrl?: string;
}

export interface PodcastEpisode {
  id: string;
  title: string;
  releaseDate: string;
  durationMinutes: number;
  description: string;
  audioUrl: string;
  fileExtension: string;
}

export interface PodcastResult {
  podcast: PodcastInfo;
  episodes: PodcastEpisode[];
}

// ── URL Parsing ──

export function isApplePodcastUrl(url: string): boolean {
  return /podcasts\.apple\.com\//.test(url);
}

export function parseApplePodcastUrl(url: string): {
  podcastId: string | null;
  episodeId: string | null;
  country: string;
} {
  const countryMatch = url.match(/apple\.com\/([a-z]{2})\//);
  const country = countryMatch?.[1] || 'us';

  const idMatch = url.match(/id(\d+)/);
  const podcastId = idMatch?.[1] || null;

  const urlObj = new URL(url);
  const episodeId = urlObj.searchParams.get('i') || null;

  return { podcastId, episodeId, country };
}

// ── iTunes API ──

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
};

async function itunesLookup(params: Record<string, string>): Promise<unknown[]> {
  const qs = new URLSearchParams(params).toString();
  const resp = await fetch(`https://itunes.apple.com/lookup?${qs}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`iTunes API ${resp.status}`);
  const data = await resp.json();
  return data.results || [];
}

function parseEpisode(raw: Record<string, unknown>): PodcastEpisode | null {
  const audioUrl = (raw.episodeUrl || raw.previewUrl) as string | undefined;
  if (!audioUrl) return null;

  const durationMs = (raw.trackTimeMillis as number) || 0;
  const releaseDate = ((raw.releaseDate as string) || '').slice(0, 10);

  // Determine file extension from URL
  let ext = '.m4a';
  try {
    const path = new URL(audioUrl).pathname;
    const urlExt = path.slice(path.lastIndexOf('.'));
    if (['.mp3', '.m4a', '.aac', '.wav', '.ogg'].includes(urlExt)) ext = urlExt;
  } catch { /* default */ }

  return {
    id: String(raw.trackId || raw.episodeGuid || Math.random()),
    title: (raw.trackName as string) || 'Untitled',
    releaseDate,
    durationMinutes: Math.round(durationMs / 60000),
    description: (raw.description as string) || (raw.shortDescription as string) || '',
    audioUrl,
    fileExtension: ext,
  };
}

// ── Fetch episodes via iTunes API ──

async function fetchEpisodeById(
  episodeId: string,
  country: string,
): Promise<{ podcast: PodcastInfo; episode: PodcastEpisode } | null> {
  const results = await itunesLookup({ id: episodeId, entity: 'podcastEpisode', country });
  if (results.length === 0) return null;

  const raw = results[0] as Record<string, unknown>;
  const episode = parseEpisode(raw);
  if (!episode) return null;

  return {
    podcast: {
      name: (raw.collectionName as string) || 'Unknown',
      artist: (raw.artistName as string) || '',
      country,
      artworkUrl: (raw.artworkUrl600 as string) || (raw.artworkUrl160 as string),
    },
    episode,
  };
}

async function fetchEpisodeList(
  podcastId: string,
  country: string,
  limit = 200,
): Promise<PodcastResult | null> {
  const results = await itunesLookup({
    id: podcastId,
    entity: 'podcastEpisode',
    country,
    limit: String(limit),
  });
  if (results.length === 0) return null;

  // First result is the podcast info
  const podcastRaw = results[0] as Record<string, unknown>;
  const podcast: PodcastInfo = {
    name: (podcastRaw.collectionName as string) || 'Unknown',
    artist: (podcastRaw.artistName as string) || '',
    country,
    artworkUrl: (podcastRaw.artworkUrl600 as string) || (podcastRaw.artworkUrl160 as string),
    feedUrl: podcastRaw.feedUrl as string | undefined,
  };

  // Rest are episodes
  const episodes = results
    .slice(1)
    .map((r) => parseEpisode(r as Record<string, unknown>))
    .filter((e): e is PodcastEpisode => e !== null);

  return { podcast, episodes };
}

// ── RSS Fallback ──

async function fetchRssFeed(
  podcastId: string,
  country: string,
): Promise<PodcastResult | null> {
  // Get RSS URL from iTunes
  const results = await itunesLookup({ id: podcastId, country, entity: 'podcast' });
  const feedUrl = (results[0] as Record<string, unknown>)?.feedUrl as string | undefined;
  if (!feedUrl) return null;

  console.log('[podcast] Falling back to RSS:', feedUrl);
  const resp = await fetch(feedUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) return null;
  const xml = await resp.text();

  // Parse RSS XML (basic regex parser — runs in service worker, no DOM)
  const channelTitle = xml.match(/<channel>[\s\S]*?<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || 'Unknown';
  const author = xml.match(/<itunes:author>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/itunes:author>/)?.[1] || '';

  const podcast: PodcastInfo = {
    name: channelTitle,
    artist: author,
    country,
    feedUrl,
  };

  // Extract episodes from <item> blocks
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const episodes: PodcastEpisode[] = [];

  for (const item of items) {
    const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || '';
    const audioMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*type="audio[^"]*"/);
    if (!audioMatch) continue;

    const audioUrl = audioMatch[1];
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    const description = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] || '';
    const durationStr = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/)?.[1] || '0';

    // Parse duration (could be seconds or HH:MM:SS)
    let durationMin = 0;
    if (durationStr.includes(':')) {
      const parts = durationStr.split(':').map(Number);
      if (parts.length === 3) durationMin = parts[0] * 60 + parts[1];
      else if (parts.length === 2) durationMin = parts[0];
    } else {
      durationMin = Math.round(parseInt(durationStr, 10) / 60);
    }

    let ext = '.m4a';
    try {
      const path = new URL(audioUrl).pathname;
      const urlExt = path.slice(path.lastIndexOf('.'));
      if (['.mp3', '.m4a', '.aac'].includes(urlExt)) ext = urlExt;
    } catch { /* default */ }

    let releaseDate = '';
    try { releaseDate = new Date(pubDate).toISOString().slice(0, 10); } catch { /* ignore */ }

    episodes.push({
      id: String(episodes.length),
      title,
      releaseDate,
      durationMinutes: durationMin,
      description: description.replace(/<[^>]+>/g, '').trim(),
      audioUrl,
      fileExtension: ext,
    });
  }

  return { podcast, episodes };
}

// ── Main entry point ──

export async function fetchPodcast(
  url: string,
  options?: { count?: number },
): Promise<PodcastResult> {
  // Route to platform-specific handler
  if (isXiaoyuzhouUrl(url)) {
    return fetchXiaoyuzhou(url, options);
  }

  const { podcastId, episodeId, country } = parseApplePodcastUrl(url);
  if (!podcastId) throw new Error('无法解析播客链接，支持 Apple Podcasts 和小宇宙');

  console.log(`[podcast] ID: ${podcastId}, episode: ${episodeId}, country: ${country}`);

  // Case 1: specific episode
  if (episodeId) {
    const result = await fetchEpisodeById(episodeId, country);
    if (result) {
      return { podcast: result.podcast, episodes: [result.episode] };
    }
    // Fall through to list search
    console.log('[podcast] Direct episode lookup failed, searching list...');
  }

  // Case 2: episode list via API
  let result = await fetchEpisodeList(podcastId, country);

  // Case 3: RSS fallback
  if (!result || result.episodes.length === 0) {
    result = await fetchRssFeed(podcastId, country);
  }

  if (!result || result.episodes.length === 0) {
    throw new Error('无法获取任何节目信息');
  }

  // If specific episode requested, filter
  if (episodeId) {
    const ep = result.episodes.find((e) => e.id === episodeId);
    if (ep) result.episodes = [ep];
  }

  // Limit count
  if (options?.count && options.count < result.episodes.length) {
    result.episodes = result.episodes.slice(0, options.count);
  }

  return result;
}

// ── Xiaoyuzhou FM (小宇宙) ──

export function isXiaoyuzhouUrl(url: string): boolean {
  return /xiaoyuzhoufm\.com\/(episode|podcast)\//.test(url);
}

/**
 * Parse a xiaoyuzhoufm.com URL into podcast/episode IDs.
 * Episode: https://www.xiaoyuzhoufm.com/episode/{eid}
 * Podcast: https://www.xiaoyuzhoufm.com/podcast/{pid}
 */
export function parseXiaoyuzhouUrl(url: string): {
  type: 'episode' | 'podcast';
  id: string;
} {
  const m = url.match(/xiaoyuzhoufm\.com\/(episode|podcast)\/([a-f0-9]+)/);
  if (!m) throw new Error('无法解析小宇宙链接');
  return { type: m[1] as 'episode' | 'podcast', id: m[2] };
}

/**
 * Extract __NEXT_DATA__ JSON from a xiaoyuzhou page HTML string.
 */
function extractNextData(html: string): Record<string, unknown> {
  const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new Error('页面中未找到 __NEXT_DATA__');
  return JSON.parse(m[1]);
}

function parseXiaoyuzhouEpisode(raw: Record<string, unknown>): PodcastEpisode {
  const enclosure = raw.enclosure as { url: string } | undefined;
  const media = raw.media as { source?: { url: string }; size?: number; mimeType?: string } | undefined;
  const audioUrl = enclosure?.url || media?.source?.url || '';

  let ext = '.mp3';
  try {
    const path = new URL(audioUrl).pathname;
    const urlExt = path.slice(path.lastIndexOf('.'));
    if (['.mp3', '.m4a', '.aac', '.wav', '.ogg'].includes(urlExt)) ext = urlExt;
  } catch { /* default */ }

  const durationSec = (raw.duration as number) || 0;
  const pubDate = (raw.pubDate as string) || '';
  let releaseDate = '';
  try { releaseDate = new Date(pubDate).toISOString().slice(0, 10); } catch { /* ignore */ }

  return {
    id: (raw.eid as string) || String(Math.random()),
    title: (raw.title as string) || 'Untitled',
    releaseDate,
    durationMinutes: Math.round(durationSec / 60),
    description: (raw.description as string) || '',
    audioUrl,
    fileExtension: ext,
  };
}

/**
 * Fetch a single episode from its xiaoyuzhou page.
 */
async function fetchXiaoyuzhouEpisode(eid: string): Promise<PodcastResult> {
  const resp = await fetch(`https://www.xiaoyuzhoufm.com/episode/${eid}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`小宇宙请求失败: ${resp.status}`);
  const html = await resp.text();
  const data = extractNextData(html);

  const ep = (data as { props: { pageProps: { episode: Record<string, unknown> } } })
    .props.pageProps.episode;
  const podRaw = ep.podcast as Record<string, unknown> | undefined;

  const podcast: PodcastInfo = {
    name: (podRaw?.title as string) || 'Unknown',
    artist: ((podRaw?.podcasters as Array<{ nickname: string }>) || [])
      .map((p) => p.nickname).join(', ') || '',
    country: 'cn',
    artworkUrl: (podRaw?.image as { picUrl: string })?.picUrl
      || (ep.image as { picUrl: string })?.picUrl,
  };

  return { podcast, episodes: [parseXiaoyuzhouEpisode(ep)] };
}

/**
 * Fetch podcast episodes from xiaoyuzhou.
 * Strategy: SSR __NEXT_DATA__ gives first 15 episodes;
 * if the podcast has an RSS feed URL in its page links, use that for the full list.
 */
async function fetchXiaoyuzhouPodcast(
  pid: string,
  options?: { count?: number },
): Promise<PodcastResult> {
  // Step 1: Get podcast info + first batch of episodes from SSR
  const resp = await fetch(`https://www.xiaoyuzhoufm.com/podcast/${pid}`, {
    headers: HEADERS,
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) throw new Error(`小宇宙请求失败: ${resp.status}`);
  const html = await resp.text();
  const data = extractNextData(html);

  const podRaw = (data as { props: { pageProps: { podcast: Record<string, unknown> } } })
    .props.pageProps.podcast;

  const podcast: PodcastInfo = {
    name: (podRaw.title as string) || 'Unknown',
    artist: ((podRaw.podcasters as Array<{ nickname: string }>) || [])
      .map((p) => p.nickname).join(', ') || '',
    country: 'cn',
    artworkUrl: (podRaw.image as { picUrl: string })?.picUrl,
  };

  const ssrEpisodes = (podRaw.episodes as Array<Record<string, unknown>>) || [];
  const totalCount = (podRaw.episodeCount as number) || ssrEpisodes.length;
  const limit = options?.count || totalCount;

  let episodes = ssrEpisodes.map(parseXiaoyuzhouEpisode);
  console.log(`[podcast:xiaoyuzhou] SSR: ${episodes.length}/${totalCount} episodes`);

  // Step 2: If we need more episodes, try to find RSS feed from page links
  if (episodes.length < limit && episodes.length < totalCount) {
    // Look for RSS feed URL in the HTML
    const rssMatch = html.match(/href="(https?:\/\/[^"]*\/feed\/podcast[^"]*)"/);
    if (rssMatch) {
      console.log(`[podcast:xiaoyuzhou] Found RSS feed: ${rssMatch[1]}`);
      try {
        const rssEpisodes = await fetchXiaoyuzhouRss(rssMatch[1], podcast);
        if (rssEpisodes.length > episodes.length) {
          episodes = rssEpisodes;
          console.log(`[podcast:xiaoyuzhou] RSS: ${episodes.length} episodes`);
        }
      } catch (e) {
        console.warn('[podcast:xiaoyuzhou] RSS fallback failed:', e);
      }
    }
  }

  // Limit
  if (limit < episodes.length) {
    episodes = episodes.slice(0, limit);
  }

  return { podcast, episodes };
}

/**
 * Parse RSS feed for full episode list (reuses existing RSS parsing logic).
 */
async function fetchXiaoyuzhouRss(
  feedUrl: string,
  podcast: PodcastInfo,
): Promise<PodcastEpisode[]> {
  const resp = await fetch(feedUrl, {
    headers: HEADERS,
    signal: AbortSignal.timeout(20000),
  });
  if (!resp.ok) throw new Error(`RSS fetch failed: ${resp.status}`);
  const xml = await resp.text();

  const items = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  const episodes: PodcastEpisode[] = [];

  for (const item of items) {
    const title = item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] || '';
    const audioMatch = item.match(/<enclosure[^>]*url="([^"]*)"[^>]*/);
    if (!audioMatch) continue;

    const audioUrl = audioMatch[1];
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || '';
    const description = item.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/)?.[1] || '';
    const durationStr = item.match(/<itunes:duration>(.*?)<\/itunes:duration>/)?.[1] || '0';

    let durationMin = 0;
    if (durationStr.includes(':')) {
      const parts = durationStr.split(':').map(Number);
      if (parts.length === 3) durationMin = parts[0] * 60 + parts[1];
      else if (parts.length === 2) durationMin = parts[0];
    } else {
      durationMin = Math.round(parseInt(durationStr, 10) / 60);
    }

    let ext = '.mp3';
    try {
      const path = new URL(audioUrl).pathname;
      const urlExt = path.slice(path.lastIndexOf('.'));
      if (['.mp3', '.m4a', '.aac'].includes(urlExt)) ext = urlExt;
    } catch { /* default */ }

    let releaseDate = '';
    try { releaseDate = new Date(pubDate).toISOString().slice(0, 10); } catch { /* ignore */ }

    episodes.push({
      id: String(episodes.length),
      title,
      releaseDate,
      durationMinutes: durationMin,
      description: description.replace(/<[^>]+>/g, '').trim(),
      audioUrl,
      fileExtension: ext,
    });
  }

  return episodes;
}

// ── Unified entry (xiaoyuzhou) ──

export async function fetchXiaoyuzhou(
  url: string,
  options?: { count?: number },
): Promise<PodcastResult> {
  const { type, id } = parseXiaoyuzhouUrl(url);
  console.log(`[podcast:xiaoyuzhou] ${type}: ${id}`);

  if (type === 'episode') {
    return fetchXiaoyuzhouEpisode(id);
  }
  return fetchXiaoyuzhouPodcast(id, options);
}

// ── Download helper ──

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200);
}

export function buildFilename(index: number, title: string, ext: string): string {
  return `${String(index).padStart(3, '0')} - ${sanitizeFilename(title)}${ext}`;
}
