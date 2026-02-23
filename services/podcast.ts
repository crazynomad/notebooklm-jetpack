/**
 * Apple Podcast downloader service.
 * Uses iTunes API (primary) + RSS feed (fallback) to find episodes and audio URLs.
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
  const { podcastId, episodeId, country } = parseApplePodcastUrl(url);
  if (!podcastId) throw new Error('无法解析 Podcast ID，请检查链接格式');

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
