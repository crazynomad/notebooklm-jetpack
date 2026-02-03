import { useState } from 'react';
import { List, Loader2, CheckCircle, AlertCircle, LayoutGrid } from 'lucide-react';
import type { ImportProgress } from '@/lib/types';
import { isValidUrl } from '@/lib/utils';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type ImportState = 'idle' | 'loading' | 'importing' | 'success' | 'error';

export function BatchImport({ onProgress }: Props) {
  const [urlsText, setUrlsText] = useState('');
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);

  const parseUrls = (text: string): string[] => {
    return text
      .split(/[\n,]/)
      .map((url) => url.trim())
      .filter((url) => url && isValidUrl(url));
  };

  const handleImportFromTabs = async () => {
    setState('loading');

    chrome.runtime.sendMessage({ type: 'GET_ALL_TABS' }, (response) => {
      if (response?.success && Array.isArray(response.data)) {
        const urls = response.data as string[];
        setUrlsText(urls.join('\n'));
        setState('idle');
      } else {
        setState('error');
        setError('获取标签页失败');
      }
    });
  };

  const handleImport = async () => {
    const urls = parseUrls(urlsText);

    if (urls.length === 0) {
      setError('请输入有效的 URL');
      setState('error');
      return;
    }

    setState('importing');
    setError('');
    setResults(null);

    // Set up progress tracking
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
        setError(response?.error || '批量导入失败');
      }
    });
  };

  const urlCount = parseUrls(urlsText).length;

  return (
    <div className="space-y-4">
      {/* Quick action: import all tabs */}
      <button
        onClick={handleImportFromTabs}
        disabled={state === 'loading' || state === 'importing'}
        className="w-full py-2 px-3 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {state === 'loading' ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <LayoutGrid className="w-4 h-4" />
        )}
        导入所有打开的标签页
      </button>

      {/* URL list input */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          URL 列表 {urlCount > 0 && <span className="text-gray-400">({urlCount} 个)</span>}
        </label>
        <textarea
          value={urlsText}
          onChange={(e) => setUrlsText(e.target.value)}
          placeholder="每行一个 URL，或用逗号分隔&#10;https://example.com/article1&#10;https://example.com/article2"
          rows={8}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-notebooklm-blue focus:border-transparent font-mono"
        />
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={urlCount === 0 || state === 'importing'}
        className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {state === 'importing' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            正在导入...
          </>
        ) : (
          <>
            <List className="w-4 h-4" />
            批量导入 {urlCount > 0 && `(${urlCount})`}
          </>
        )}
      </button>

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
          成功 {results.success} 个{results.failed > 0 && `，失败 ${results.failed} 个`}
        </div>
      )}

      {state === 'error' && !results && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}
    </div>
  );
}
