import { useState } from 'react';
import { Headphones, Loader2, CheckCircle, AlertCircle, Download, Music } from 'lucide-react';
import type { PodcastInfo, PodcastEpisode } from '@/services/podcast';

type State = 'idle' | 'loading' | 'loaded' | 'downloading' | 'done' | 'error';

export function PodcastImport() {
  const [url, setUrl] = useState('');
  const [count, setCount] = useState<number | undefined>(undefined);
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [podcast, setPodcast] = useState<PodcastInfo | null>(null);
  const [episodes, setEpisodes] = useState<PodcastEpisode[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ current: number; total: number; title?: string }>({ current: 0, total: 0 });

  const handleFetch = () => {
    if (!url) { setError('请输入 Apple Podcast 链接'); setState('error'); return; }
    setState('loading');
    setError('');
    setPodcast(null);
    setEpisodes([]);

    chrome.runtime.sendMessage(
      { type: 'FETCH_PODCAST', url, count },
      (resp) => {
        if (resp?.success && resp.data) {
          const data = resp.data as { podcast: PodcastInfo; episodes: PodcastEpisode[] };
          setPodcast(data.podcast);
          setEpisodes(data.episodes);
          setSelected(new Set(data.episodes.map((e) => e.id)));
          setState('loaded');
        } else {
          setState('error');
          setError(resp?.error || '获取失败');
        }
      },
    );
  };

  const handleDownload = () => {
    const toDownload = episodes.filter((e) => selected.has(e.id));
    if (toDownload.length === 0) { setError('请至少选择一集'); setState('error'); return; }

    setState('downloading');
    setProgress({ current: 0, total: toDownload.length });

    const port = chrome.runtime.connect({ name: 'podcast-download' });
    port.postMessage({
      type: 'DOWNLOAD_PODCAST',
      podcast,
      episodes: toDownload,
    });

    port.onMessage.addListener((msg) => {
      if (msg.phase === 'downloading') {
        setProgress({ current: msg.current, total: msg.total, title: msg.title });
      } else if (msg.phase === 'done') {
        setState('done');
        port.disconnect();
      } else if (msg.phase === 'error') {
        setState('error');
        setError(msg.error || '下载失败');
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (state === 'downloading') setState('done');
    });
  };

  const toggleEpisode = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(episodes.map((e) => e.id)));
  const selectNone = () => setSelected(new Set());

  return (
    <div className="space-y-4">
      {/* Input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Apple Podcast 链接
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Headphones className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://podcasts.apple.com/cn/podcast/id..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-notebooklm-blue focus:border-transparent"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <label className="text-xs text-gray-500">最新</label>
          <input
            type="number"
            value={count || ''}
            onChange={(e) => setCount(e.target.value ? parseInt(e.target.value) : undefined)}
            placeholder="全部"
            min={1}
            max={200}
            className="w-16 px-2 py-1 border border-gray-200 rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-notebooklm-blue"
          />
          <label className="text-xs text-gray-500">集</label>
          <div className="flex-1" />
          <button
            onClick={handleFetch}
            disabled={!url || state === 'loading'}
            className="px-4 py-1.5 bg-purple-500 text-white text-xs rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
          >
            {state === 'loading' ? (
              <><Loader2 className="w-3 h-3 animate-spin" />查询中...</>
            ) : (
              <><Music className="w-3 h-3" />查询</>
            )}
          </button>
        </div>
      </div>

      {/* Podcast Info */}
      {podcast && (
        <div className="bg-purple-50 rounded-lg p-3 flex items-center gap-3">
          {podcast.artworkUrl && (
            <img src={podcast.artworkUrl} alt="" className="w-12 h-12 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-purple-900 truncate">{podcast.name}</p>
            <p className="text-xs text-purple-600">{podcast.artist} · {episodes.length} 集</p>
          </div>
        </div>
      )}

      {/* Episode List */}
      {episodes.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              已选 {selected.size}/{episodes.length} 集
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-notebooklm-blue hover:underline">全选</button>
              <button onClick={selectNone} className="text-gray-400 hover:underline">取消全选</button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {episodes.map((ep) => (
              <label
                key={ep.id}
                className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selected.has(ep.id)}
                  onChange={() => toggleEpisode(ep.id)}
                  className="mt-1 rounded border-gray-300 text-purple-500 focus:ring-purple-500"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-clamp-1">{ep.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {ep.releaseDate} {ep.durationMinutes > 0 && `· ${ep.durationMinutes} 分钟`}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Download Button */}
      {episodes.length > 0 && (
        <button
          onClick={handleDownload}
          disabled={selected.size === 0 || state === 'downloading'}
          className="w-full py-2.5 bg-purple-500 text-white text-sm rounded-lg hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state === 'downloading' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              下载中 {progress.current}/{progress.total}
              {progress.title && <span className="text-purple-200 text-xs truncate max-w-[150px]">· {progress.title}</span>}
            </>
          ) : state === 'done' ? (
            <>
              <CheckCircle className="w-4 h-4" />
              下载完成
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              下载选中 ({selected.size} 集)
            </>
          )}
        </button>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Help */}
      {!podcast && state === 'idle' && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>支持的链接格式：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>播客主页：podcasts.apple.com/.../id123456</li>
            <li>单集链接：...id123456?i=789012</li>
            <li>支持所有地区（cn/us/jp 等）</li>
          </ul>
        </div>
      )}
    </div>
  );
}
