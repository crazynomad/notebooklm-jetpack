import { useState, useMemo, useEffect, useRef } from 'react';
import { Youtube, Loader2, CheckCircle, AlertCircle, PlayCircle, ListVideo, User, ChevronDown } from 'lucide-react';
import type { ImportProgress, YouTubeResult, YouTubeVideoItem, YouTubeSourceInfo } from '@/lib/types';
import { t } from '@/lib/i18n';
import { isYouTubeUrl, parseYouTubeUrl } from '@/services/youtube';

type State = 'idle' | 'loading' | 'loaded' | 'importing' | 'done' | 'error';

const sourceIcons = {
  video: PlayCircle,
  playlist: ListVideo,
  channel: User,
};

interface Props {
  initialUrl?: string;
  onProgress: (progress: ImportProgress | null) => void;
}

export function YouTubeImport({ initialUrl, onProgress }: Props) {
  const [url, setUrl] = useState(initialUrl || '');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [source, setSource] = useState<YouTubeSourceInfo | null>(null);
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [continuation, setContinuation] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);

  const urlType = useMemo(() => {
    if (!url || !isYouTubeUrl(url)) return 'unknown';
    return parseYouTubeUrl(url).type;
  }, [url]);

  const SourceIcon = sourceIcons[urlType as keyof typeof sourceIcons] || Youtube;

  const handleFetch = () => {
    if (!url) { setError(t('youtube.enterLink')); setState('error'); return; }
    if (urlType === 'unknown') { setError(t('youtube.unrecognized')); setState('error'); return; }

    setState('loading');
    setError('');
    setSource(null);
    setVideos([]);
    setResults(null);
    setContinuation(undefined);

    chrome.runtime.sendMessage(
      { type: 'FETCH_YOUTUBE', url },
      (resp) => {
        if (resp?.success && resp.data) {
          const data = resp.data as YouTubeResult;
          setSource(data.source);
          setVideos(data.videos);
          setSelected(new Set(data.videos.map((v) => v.id)));
          setContinuation(data.continuation);
          setState('loaded');
        } else {
          setState('error');
          setError(resp?.error || t('youtube.fetchFailed'));
        }
      },
    );
  };

  const handleLoadMore = () => {
    if (!continuation || loadingMore) return;
    setLoadingMore(true);

    chrome.runtime.sendMessage(
      { type: 'FETCH_YOUTUBE_MORE', continuation },
      (resp) => {
        setLoadingMore(false);
        if (resp?.success && resp.data) {
          const data = resp.data as { videos: YouTubeVideoItem[]; continuation?: string };
          setVideos((prev) => [...prev, ...data.videos]);
          setSelected((prev) => {
            const next = new Set(prev);
            data.videos.forEach((v) => next.add(v.id));
            return next;
          });
          setContinuation(data.continuation);
          if (source) {
            setSource({ ...source, videoCount: (source.videoCount || 0) + data.videos.length });
          }
        }
      },
    );
  };

  // Auto-fetch when opened from a YouTube tab (initialUrl provided)
  const autoFetched = useRef(false);
  useEffect(() => {
    if (initialUrl && isYouTubeUrl(initialUrl) && !autoFetched.current) {
      autoFetched.current = true;
      handleFetch();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleImport = () => {
    const toImport = videos.filter((v) => selected.has(v.id));
    if (toImport.length === 0) { setError(t('youtube.selectAtLeastOne')); setState('error'); return; }

    setState('importing');
    const urls = toImport.map((v) => v.url);

    const progress: ImportProgress = {
      total: urls.length,
      completed: 0,
      items: urls.map((u) => ({ url: u, status: 'pending' })),
    };
    onProgress(progress);

    chrome.runtime.sendMessage({ type: 'IMPORT_BATCH', urls }, (response) => {
      onProgress(null);

      if (response?.success && response.data) {
        const result = response.data as ImportProgress;
        const success = result.items.filter((i) => i.status === 'success').length;
        const failed = result.items.filter((i) => i.status === 'error').length;
        setResults({ success, failed });
        setState('done');
      } else {
        setState('error');
        setError(response?.error || t('importFailed'));
      }
    });
  };

  const toggleVideo = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(videos.map((v) => v.id)));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="space-y-4">
      {/* Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
          <Youtube className="w-4 h-4 text-red-500" />
          {t('youtube.link')}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SourceIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t('youtube.placeholder')}
              className="w-full pl-10 pr-3 py-2 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500/40 focus:border-transparent placeholder:text-gray-400/70"
            />
          </div>
          <button
            onClick={handleFetch}
            disabled={!url || state === 'loading'}
            className="px-4 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
          >
            {state === 'loading' ? (
              <><Loader2 className="w-3 h-3 animate-spin" />{t('youtube.querying')}</>
            ) : (
              <><Youtube className="w-3 h-3" />{t('youtube.query')}</>
            )}
          </button>
        </div>
      </div>

      {/* Source Info */}
      {source && (
        <div className="bg-red-50 border border-red-100/60 rounded-lg p-3 flex items-center gap-3 shadow-soft">
          <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
            <SourceIcon className="w-5 h-5 text-red-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-red-900 truncate">{source.title}</p>
            <p className="text-xs text-red-600">
              <span className="font-mono tabular-nums">{videos.length}</span> {t('youtube.videos')}
            </p>
          </div>
        </div>
      )}

      {/* Video List (playlist/channel) */}
      {videos.length > 1 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {t('youtube.selectedVideos', { selected: selected.size, total: videos.length })}
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-red-500 hover:underline">{t('selectAll')}</button>
              <button onClick={selectNone} className="text-gray-400 hover:underline">{t('deselectAll')}</button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border border-border-strong rounded-lg shadow-soft">
            {videos.map((video) => (
              <label
                key={video.id}
                className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
              >
                <input
                  type="checkbox"
                  checked={selected.has(video.id)}
                  onChange={() => toggleVideo(video.id)}
                  className="mt-1 rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-clamp-1">{video.title}</p>
                  {video.publishedAt && (
                    <p className="text-xs text-gray-400 mt-0.5">{video.publishedAt}</p>
                  )}
                </div>
              </label>
            ))}
          </div>
          {/* Load More */}
          {continuation && (
            <button
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="w-full mt-2 py-1.5 text-xs text-red-500 hover:text-red-600 hover:bg-red-50 border border-red-200/60 rounded-lg flex items-center justify-center gap-1 transition-colors duration-150 disabled:opacity-50"
            >
              {loadingMore ? (
                <><Loader2 className="w-3 h-3 animate-spin" />{t('youtube.loadingMore')}</>
              ) : (
                <><ChevronDown className="w-3 h-3" />{t('youtube.loadMore')}</>
              )}
            </button>
          )}
        </div>
      )}

      {/* Import Button */}
      {videos.length > 0 && (
        <button
          onClick={handleImport}
          disabled={selected.size === 0 || state === 'importing'}
          className="w-full py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
        >
          {state === 'importing' ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{t('importing')}</>
          ) : state === 'done' ? (
            <><CheckCircle className="w-4 h-4" />{t('youtube.importDone')}</>
          ) : videos.length === 1 ? (
            <><PlayCircle className="w-4 h-4" />{t('youtube.importThisVideo')}</>
          ) : (
            <><Youtube className="w-4 h-4" />{t('youtube.importToNlm', { count: selected.size })}</>
          )}
        </button>
      )}

      {/* Results */}
      {results && (
        <div className="text-sm text-center">
          {results.failed === 0 ? (
            <span className="text-green-600">{t('successCount', { success: results.success })}</span>
          ) : (
            <span className="text-amber-600">{t('successFailCount', { success: results.success, failed: results.failed })}</span>
          )}
        </div>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100/60 rounded-lg p-3 shadow-soft">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Help */}
      {!source && state === 'idle' && (
        <div className="text-xs text-gray-400 space-y-1 bg-surface-sunken rounded-xl p-3.5">
          <p>{t('youtube.supportedFormats')}</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>{t('youtube.formatVideo')}</li>
            <li>{t('youtube.formatPlaylist')}</li>
            <li>{t('youtube.formatChannel')}</li>
            <li>{t('youtube.formatShort')}</li>
          </ul>
        </div>
      )}
    </div>
  );
}
