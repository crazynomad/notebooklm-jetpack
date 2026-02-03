import { useState } from 'react';
import { Rss, Loader2, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import type { ImportProgress, RssFeedItem } from '@/lib/types';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type State = 'idle' | 'loading' | 'loaded' | 'importing' | 'success' | 'error';

export function RssImport({ onProgress }: Props) {
  const [rssUrl, setRssUrl] = useState('');
  const [articles, setArticles] = useState<RssFeedItem[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const handleLoadFeed = async () => {
    if (!rssUrl) {
      setError('请输入 RSS 订阅地址');
      setState('error');
      return;
    }

    setState('loading');
    setError('');
    setArticles([]);

    chrome.runtime.sendMessage({ type: 'PARSE_RSS', rssUrl }, (response) => {
      if (response?.success && Array.isArray(response.data)) {
        const items = response.data as RssFeedItem[];
        setArticles(items);
        setSelectedArticles(new Set(items.map((a) => a.url)));
        setState('loaded');
      } else {
        setState('error');
        setError(response?.error || '解析 RSS 失败，请检查 URL 是否正确');
      }
    });
  };

  const handleToggleArticle = (url: string) => {
    setSelectedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedArticles(new Set(articles.map((a) => a.url)));
  };

  const handleDeselectAll = () => {
    setSelectedArticles(new Set());
  };

  const handleImport = async () => {
    const urls = articles.filter((a) => selectedArticles.has(a.url)).map((a) => a.url);

    if (urls.length === 0) {
      setError('请至少选择一篇文章');
      setState('error');
      return;
    }

    setState('importing');
    setError('');
    setResults(null);

    const progress: ImportProgress = {
      total: urls.length,
      completed: 0,
      items: urls.map((url) => ({ url, status: 'pending' })),
    };
    onProgress(progress);

    chrome.runtime.sendMessage({ type: 'IMPORT_BATCH', urls }, (response) => {
      onProgress(null);

      if (response?.success && response.data) {
        const result = response.data as ImportProgress;
        const success = result.items.filter((i) => i.status === 'success').length;
        const failed = result.items.filter((i) => i.status === 'error').length;

        setResults({ success, failed });
        setState(failed > 0 ? 'error' : 'success');
      } else {
        setState('error');
        setError(response?.error || '导入失败');
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* RSS URL input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">RSS 订阅地址</label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Rss className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://example.com/feed.xml"
              className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-notebooklm-blue focus:border-transparent"
            />
          </div>
          <button
            onClick={handleLoadFeed}
            disabled={!rssUrl || state === 'loading'}
            className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {state === 'loading' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            加载
          </button>
        </div>
      </div>

      {/* Article list */}
      {articles.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              已选择 {selectedArticles.size}/{articles.length} 篇文章
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={handleSelectAll} className="text-notebooklm-blue hover:underline">
                全选
              </button>
              <button onClick={handleDeselectAll} className="text-gray-400 hover:underline">
                取消全选
              </button>
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
            {articles.map((article) => (
              <label
                key={article.url}
                className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedArticles.has(article.url)}
                  onChange={() => handleToggleArticle(article.url)}
                  className="mt-1 rounded border-gray-300 text-notebooklm-blue focus:ring-notebooklm-blue"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-700 line-clamp-2">{article.title}</p>
                  {article.pubDate && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(article.pubDate).toLocaleDateString('zh-CN')}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Import button */}
      {articles.length > 0 && (
        <button
          onClick={handleImport}
          disabled={selectedArticles.size === 0 || state === 'importing'}
          className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state === 'importing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在导入...
            </>
          ) : (
            <>
              <Rss className="w-4 h-4" />
              导入选中文章 ({selectedArticles.size})
            </>
          )}
        </button>
      )}

      {/* Results */}
      {results && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg p-3 ${
            results.failed > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-600'
          }`}
        >
          {results.failed > 0 ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          成功 {results.success} 篇{results.failed > 0 && `，失败 ${results.failed} 篇`}
        </div>
      )}

      {state === 'error' && !results && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Tips */}
      {articles.length === 0 && state === 'idle' && (
        <div className="text-xs text-gray-400 space-y-1">
          <p>常见 RSS 地址格式：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>博客: /feed, /rss, /atom.xml</li>
            <li>Medium: medium.com/feed/@username</li>
            <li>Substack: xxx.substack.com/feed</li>
          </ul>
        </div>
      )}
    </div>
  );
}
