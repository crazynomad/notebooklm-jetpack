// YouTube Channel Configuration
export const CHANNEL_CONFIG = {
  name: '绿皮火车',
  id: 'UCJhUtNsR5pvU_gWWkxxUXUQ',
  subscribeUrl: 'https://www.youtube.com/channel/UCJhUtNsR5pvU_gWWkxxUXUQ?sub_confirmation=1',
} as const;

// Cache Configuration
export const CACHE_CONFIG = {
  subscriptionCacheDuration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  subscriptionCacheKey: 'subscription_status',
} as const;

// NotebookLM Configuration
export const NOTEBOOKLM_CONFIG = {
  baseUrl: 'https://notebooklm.google.com',
  importDelay: 1500, // Delay between batch imports (ms)
} as const;

// YouTube API Configuration
export const YOUTUBE_API_CONFIG = {
  baseUrl: 'https://www.googleapis.com/youtube/v3',
  scopes: ['https://www.googleapis.com/auth/youtube.readonly'],
} as const;
