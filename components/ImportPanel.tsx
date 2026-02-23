import { useState } from 'react';
import {
  Link,
  Loader2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  LayoutGrid,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Rss,
  List,
  FileText,
} from 'lucide-react';
import type { ImportProgress, ImportItem, RssFeedItem } from '@/lib/types';
import { isValidUrl } from '@/lib/utils';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type ImportState = 'idle' | 'loading' | 'importing' | 'success' | 'error';
type Mode = 'single' | 'batch' | 'rss';

export function ImportPanel({ onProgress }: Props) {
  const [mode, setMode] = useState<Mode>('single');
  const [url, setUrl] = useState('');
  const [urlsText, setUrlsText] = useState('');
  const [rssUrl, setRssUrl] = useState('');
  const [rssArticles, setRssArticles] = useState<RssFeedItem[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [currentTabUrl, setCurrentTabUrl] = useState<string | null>(null);
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState('');
  const [importResults, setImportResults] = useState<ImportItem[] | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Load current tab URL on mount
  useState(() => {
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB' }, (response) => {
      if (response?.success && response.data) {
        setCurrentTabUrl(response.data as string);
      }
    });
  });

  const resetState = () => {
    setState('idle');
    setError('');
    setImportResults(null);
  };

  // ── Single Import ──
  const handleSingleImport = (targetUrl: string) => {
    if (!isValidUrl(targetUrl)) {
      setError('请输入有效的 URL');
      setState('error');
      return;
    }

    setState('importing');
    setError('');

    onProgress({
      total: 1,
      completed: 0,
      items: [{ url: targetUrl, status: 'importing' }],
    });

    chrome.runtime.sendMessage({ type: 'IMPORT_URL', url: targetUrl }, (response) => {
      onProgress(null);
      if (response?.success && response.data) {
        setState('success');
        setTimeout(() => setState('idle'), 3000);
      } else {
        setState('error');
        setError(response?.error || '导入失败，请确保 NotebookLM 页面已打开');
      }
    });
  };

  // ── Batch Import ──
  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,]/)
      .map((u) => u.trim())
      .filter((u) => u && isValidUrl(u));
  };

  const handleBatchImport = (urls?: string[]) => {
    const urlsToImport = urls || parseUrls(urlsText);
    if (urlsToImport.length === 0) {
      setError('请输入有效的 URL');
      setState('error');
      return;
    }

    setState('importing');
    setError('');
    if (!urls) setImportResults(null);

    onProgress({
      total: urlsToImport.length,
      completed: 0,
      items: urlsToImport.map((u) => ({ url: u, status: 'pending' })),
    });

    chrome.runtime.sendMessage({ type: 'IMPORT_BATCH', urls: urlsToImport }, (response) => {
      onProgress(null);
      if (response?.success && response.data) {
        const result = response.data as ImportProgress;
        const hasErrors = result.items.some((i) => i.status === 'error');
        if (urls && importResults) {
          const updatedResults = importResults.map((item) => {
            const newResult = result.items.find((r) => r.url === item.url);
            return newResult || item;
          });
          setImportResults(updatedResults);
        } else {
          setImportResults(result.items);
        }
        setState(hasErrors ? 'error' : 'success');
      } else {
        setState('error');
        setError(response?.error || '批量导入失败');
      }
    });
  };

  const handleImportFromTabs = () => {
    setState('loading');
    chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' }, (response) => {
      if (response?.success && Array.isArray(response.data)) {
        setUrlsText((response.data as string[]).join('\n'));
        setState('idle');
      } else {
        setState('error');
        setError('获取标签页失败');
      }
    });
  };

  // ── RSS Import ──
  const handleRssLoad = () => {
    if (!rssUrl) { setError('请输入 RSS 链接'); setState('error'); return; }
    setState('loading');
    setError('');
    setRssArticles([]);

    chrome.runtime.sendMessage({ type: 'PARSE_RSS', rssUrl }, (response) => {
      if (response?.success && Array.isArray(response.data)) {
        const items = response.data as RssFeedItem[];
        setRssArticles(items);
        setSelectedArticles(new Set(items.map((a) => a.url)));
        setState('idle');
      } else {
        setState('error');
        setError(response?.error || 'RSS 解析失败');
      }
    });
  };

  const handleRssImport = () => {
    const urls = rssArticles.filter((a) => selectedArticles.has(a.url)).map((a) => a.url);
    if (urls.length === 0) { setError('请至少选择一篇文章'); setState('error'); return; }
    // Reuse batch import logic
    setUrlsText(urls.join('\n'));
    handleBatchImport(urls);
  };

  const handleRetryFailed = () => {
    if (!importResults) return;
    const failedUrls = importResults.filter((i) => i.status === 'error').map((i) => i.url);
    if (failedUrls.length > 0) handleBatchImport(failedUrls);
  };

  const handleRetrySingle = (targetUrl: string) => {
    handleBatchImport([targetUrl]);
  };

  const urlCount = parseUrls(urlsText).length;
  const successCount = importResults?.filter((i) => i.status === 'success').length || 0;
  const failedCount = importResults?.filter((i) => i.status === 'error').length || 0;

  const modes: { key: Mode; label: string; icon: typeof Link }[] = [
    { key: 'single', label: '单个', icon: Link },
    { key: 'batch', label: '批量', icon: List },
    { key: 'rss', label: 'RSS', icon: Rss },
  ];

  return (
    <div className="space-y-4">
      {/* Mode switcher */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
        {modes.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setMode(key); resetState(); }}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium rounded-md transition-colors ${
              mode === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Single Mode ── */}
      {mode === 'single' && (
        <>
          {currentTabUrl && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">当前标签页</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-sm text-gray-700 truncate">{currentTabUrl}</span>
                <button
                  onClick={() => { setUrl(currentTabUrl); handleSingleImport(currentTabUrl); }}
                  disabled={state === 'importing'}
                  className="px-3 py-1.5 bg-notebooklm-blue text-white text-xs rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {state === 'importing' ? <Loader2 className="w-3 h-3 animate-spin" /> : <ExternalLink className="w-3 h-3" />}
                  导入
                </button>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">输入 URL</label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://example.com/article"
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-notebooklm-blue focus:border-transparent"
                />
              </div>
              <button
                onClick={() => handleSingleImport(url)}
                disabled={!url || state === 'importing'}
                className="px-4 py-2 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {state === 'importing' ? <><Loader2 className="w-4 h-4 animate-spin" />导入中</> : '导入'}
              </button>
            </div>
          </div>
          <div className="text-xs text-gray-400 space-y-1">
            <p>支持导入：网页文章、YouTube 视频（自动提取字幕）、PDF 链接</p>
          </div>
        </>
      )}

      {/* ── Batch Mode ── */}
      {mode === 'batch' && (
        <>
          <button
            onClick={handleImportFromTabs}
            disabled={state === 'loading' || state === 'importing'}
            className="w-full py-2 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <LayoutGrid className="w-4 h-4" />}
            导入所有打开的标签页
          </button>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              URL 列表 {urlCount > 0 && <span className="text-gray-400">({urlCount} 个)</span>}
            </label>
            <textarea
              value={urlsText}
              onChange={(e) => setUrlsText(e.target.value)}
              placeholder={'每行一个 URL，或用逗号分隔\nhttps://example.com/article1\nhttps://example.com/article2'}
              rows={6}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-notebooklm-blue focus:border-transparent font-mono"
            />
          </div>
          <button
            onClick={() => handleBatchImport()}
            disabled={urlCount === 0 || state === 'importing'}
            className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {state === 'importing' ? <><Loader2 className="w-4 h-4 animate-spin" />正在导入...</> : <><List className="w-4 h-4" />批量导入 {urlCount > 0 && `(${urlCount})`}</>}
          </button>
        </>
      )}

      {/* ── RSS Mode ── */}
      {mode === 'rss' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">RSS / Atom 链接</label>
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
                onClick={handleRssLoad}
                disabled={!rssUrl || state === 'loading'}
                className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                加载
              </button>
            </div>
          </div>

          {rssArticles.length > 0 && (
            <>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-gray-600">已选择 {selectedArticles.size}/{rssArticles.length} 篇</span>
                  <div className="flex gap-2 text-xs">
                    <button onClick={() => setSelectedArticles(new Set(rssArticles.map((a) => a.url)))} className="text-notebooklm-blue hover:underline">全选</button>
                    <button onClick={() => setSelectedArticles(new Set())} className="text-gray-400 hover:underline">取消全选</button>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                  {rssArticles.map((article) => (
                    <label key={article.url} className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                      <input
                        type="checkbox"
                        checked={selectedArticles.has(article.url)}
                        onChange={() => {
                          setSelectedArticles((prev) => {
                            const next = new Set(prev);
                            if (next.has(article.url)) next.delete(article.url);
                            else next.add(article.url);
                            return next;
                          });
                        }}
                        className="mt-1 rounded border-gray-300 text-notebooklm-blue focus:ring-notebooklm-blue"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-2">{article.title}</p>
                        {article.pubDate && <p className="text-xs text-gray-400 mt-0.5">{new Date(article.pubDate).toLocaleDateString('zh-CN')}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <button
                onClick={handleRssImport}
                disabled={selectedArticles.size === 0 || state === 'importing'}
                className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {state === 'importing' ? <><Loader2 className="w-4 h-4 animate-spin" />正在导入...</> : <><Rss className="w-4 h-4" />导入选中文章 ({selectedArticles.size})</>}
              </button>
            </>
          )}

          {rssArticles.length === 0 && state === 'idle' && (
            <div className="text-xs text-gray-400 space-y-1">
              <p>常见 RSS 格式：/feed, /rss, /atom.xml, medium.com/feed/@user</p>
            </div>
          )}
        </>
      )}

      {/* ── Results (shared by batch/single) ── */}
      {state === 'success' && !importResults && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-lg p-3">
          <CheckCircle className="w-4 h-4" />
          导入成功！
        </div>
      )}

      {importResults && importResults.length > 0 && (
        <div className="space-y-2">
          <div className={`flex items-center justify-between text-sm rounded-lg p-3 ${failedCount > 0 ? 'bg-yellow-50' : 'bg-green-50'}`}>
            <div className="flex items-center gap-2">
              {failedCount > 0 ? <AlertCircle className="w-4 h-4 text-yellow-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
              <span className={failedCount > 0 ? 'text-yellow-700' : 'text-green-600'}>
                成功 {successCount} 个{failedCount > 0 && `，失败 ${failedCount} 个`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <button onClick={handleRetryFailed} disabled={state === 'importing'} className="text-xs text-yellow-700 hover:text-yellow-800 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />重试失败
                </button>
              )}
              <button onClick={() => setShowDetails(!showDetails)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                {showDetails ? <><ChevronUp className="w-3 h-3" />收起</> : <><ChevronDown className="w-3 h-3" />详情</>}
              </button>
            </div>
          </div>
          {showDetails && (
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
              {importResults.map((item, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                  {item.status === 'success'
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  <span className="flex-1 truncate text-gray-600" title={item.url}>{item.url}</span>
                  {item.status === 'error' && (
                    <button onClick={() => handleRetrySingle(item.url)} disabled={state === 'importing'} className="text-gray-400 hover:text-notebooklm-blue flex-shrink-0" title="重试">
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {state === 'error' && !importResults && mode !== 'single' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
      {state === 'error' && mode === 'single' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
