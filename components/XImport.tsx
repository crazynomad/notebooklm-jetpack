import { useState, useEffect, useRef } from 'react';
import { Loader2, CheckCircle, AlertCircle, Link2, FileText } from 'lucide-react';
import type { ImportProgress, ImportItem } from '@/lib/types';
import { XIcon } from '@/components/XIcon';
import { StickyActionBar } from '@/components/StickyActionBar';
import { t } from '@/lib/i18n';

type State = 'idle' | 'importing' | 'done' | 'error';

interface Props {
  initialUrl?: string;
  onProgress: (progress: ImportProgress | null) => void;
}

export function isXUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/\w+\/status\/\d+/.test(url)
    || /^https?:\/\/(www\.)?(x\.com|twitter\.com)\/\w+\/article\/\d+/.test(url);
}

export function XImport({ initialUrl, onProgress }: Props) {
  const [url, setUrl] = useState(initialUrl && isXUrl(initialUrl) ? initialUrl : '');
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportItem | null>(null);

  const handleImport = (targetUrl: string) => {
    if (!targetUrl) { setError(t('x.enterLink')); setState('error'); return; }
    if (!isXUrl(targetUrl)) { setError(t('x.unrecognized')); setState('error'); return; }

    setState('importing');
    setError('');
    setResult(null);
    onProgress({ total: 1, completed: 0, items: [{ url: targetUrl, status: 'pending' }] });

    // Reuse the tab-based rescue pipeline: background opens the X page in a
    // background tab, waits for the SPA to render, runs the X extractor, and
    // imports the extracted text into NotebookLM.
    chrome.runtime.sendMessage({ type: 'RESCUE_SOURCES', urls: [targetUrl] }, (response) => {
      onProgress(null);
      if (response?.success && Array.isArray(response.data) && response.data[0]) {
        const item = response.data[0] as ImportItem;
        setResult(item);
        setState(item.status === 'success' ? 'done' : 'error');
        if (item.status !== 'success') setError(item.error || t('x.extractFailed'));
      } else {
        setState('error');
        setError(response?.error || t('importFailed'));
      }
    });
  };

  // Auto-import when opened from an X tab (initialUrl provided).
  const autoRan = useRef(false);
  useEffect(() => {
    if (initialUrl && isXUrl(initialUrl) && !autoRan.current) {
      autoRan.current = true;
      handleImport(initialUrl);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-4">
      {/* Input */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
          <XIcon className="w-3.5 h-3.5 text-gray-900" />
          {t('x.link')}
        </label>
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://x.com/user/status/..."
              className="w-full pl-10 pr-3 py-2 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900/30 focus:border-transparent placeholder:text-gray-400/70"
            />
          </div>
          <button
            onClick={() => handleImport(url)}
            disabled={!url || state === 'importing'}
            className="px-4 py-1.5 bg-gray-900 hover:bg-gray-800 text-white text-xs rounded-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
          >
            {state === 'importing'
              ? <><Loader2 className="w-3 h-3 animate-spin" />{t('importing')}</>
              : <><XIcon className="w-3 h-3" />{t('import')}</>}
          </button>
        </div>
      </div>

      {/* Result */}
      {result && state === 'done' && (
        <StickyActionBar>
          <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-100/60 rounded-lg p-3 shadow-soft">
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
            <span className="flex-1 min-w-0 truncate" title={result.title || result.url}>
              {t('x.imported')}{result.title ? `：${result.title}` : ''}
            </span>
          </div>
        </StickyActionBar>
      )}

      {/* Error */}
      {state === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100/60 rounded-lg p-3 shadow-soft">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Help */}
      {state === 'idle' && !result && (
        <div className="text-xs text-gray-400 space-y-1.5 bg-surface-sunken rounded-xl p-3.5">
          <p className="flex items-center gap-1.5 text-gray-500 font-medium">
            <FileText className="w-3.5 h-3.5" />{t('x.supported')}
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>{t('x.formatTweet')}</li>
            <li>{t('x.formatArticle')}</li>
          </ul>
          <p className="pt-1 text-gray-400/90">{t('x.renderNote')}</p>
        </div>
      )}
    </div>
  );
}
