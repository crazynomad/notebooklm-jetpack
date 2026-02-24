import { useState } from 'react';
import { AlertTriangle, Loader2, CheckCircle, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { t } from '@/lib/i18n';

interface RescueResult {
  url: string;
  status: 'success' | 'error';
  title?: string;
  error?: string;
}

interface Props {
  tabId: number;
}

export function RescueBanner({ tabId }: Props) {
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const [state, setState] = useState<'idle' | 'scanning' | 'rescuing' | 'done'>('idle');
  const [results, setResults] = useState<RescueResult[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleScan = () => {
    setState('scanning');
    chrome.runtime.sendMessage({ type: 'GET_FAILED_SOURCES', tabId }, (resp) => {
      const urls = (resp?.success ? resp.data : resp?.data || resp) as string[] || [];
      setFailedUrls(urls);
      setScanned(true);
      setState('idle');
    });
  };

  const handleRescue = () => {
    if (failedUrls.length === 0) return;
    setState('rescuing');
    setResults([]);

    chrome.runtime.sendMessage({ type: 'RESCUE_SOURCES', urls: failedUrls }, (resp) => {
      const data = (resp?.success ? resp.data : resp) as RescueResult[] || [];
      setResults(data);
      setState('done');
    });
  };

  // Auto-scan on first render
  if (!scanned && state === 'idle') {
    handleScan();
  }

  const successCount = results.filter((r) => r.status === 'success').length;
  const failCount = results.filter((r) => r.status === 'error').length;

  // Nothing to show if no failed sources found
  if (scanned && failedUrls.length === 0 && state !== 'scanning') {
    return null;
  }

  return (
    <div className="mx-4 mt-3 rounded-lg border border-amber-200/60 bg-amber-50/60 overflow-hidden shadow-soft animate-slide-up">
      {/* Header */}
      <div className="px-3 py-2.5 flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {state === 'scanning' && (
            <span className="text-sm text-amber-700 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />{t('rescue.scanning')}
            </span>
          )}
          {state === 'idle' && failedUrls.length > 0 && (
            <span className="text-sm text-amber-700">
              {t('rescue.foundFailed', { count: failedUrls.length })}
            </span>
          )}
          {state === 'rescuing' && (
            <span className="text-sm text-amber-700 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />{t('rescue.rescuing')}
            </span>
          )}
          {state === 'done' && (
            <span className="text-sm text-amber-700">
              {t('rescue.done', { success: successCount, failed: failCount })}
            </span>
          )}
        </div>

        {state === 'idle' && failedUrls.length > 0 && (
          <button
            onClick={handleRescue}
            className="btn-press px-3 py-1 bg-amber-500 text-white text-xs rounded-md hover:bg-amber-600 flex items-center gap-1 flex-shrink-0 shadow-btn hover:shadow-btn-hover transition-all duration-150"
          >
            <RefreshCw className="w-3 h-3" />
            {t('rescue.rescue')}
          </button>
        )}

        {(failedUrls.length > 0 || results.length > 0) && (
          <button onClick={() => setExpanded(!expanded)} className="text-amber-500 hover:text-amber-700">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Expandable details */}
      {expanded && (
        <div className="border-t border-amber-200/60 max-h-32 overflow-y-auto">
          {results.length > 0 ? (
            results.map((r, i) => (
              <div key={i} className="px-3 py-1.5 flex items-center gap-2 text-xs border-b border-amber-100 last:border-b-0">
                {r.status === 'success'
                  ? <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />
                  : <AlertTriangle className="w-3 h-3 text-red-500 flex-shrink-0" />}
                <span className="flex-1 truncate text-gray-600 font-mono text-xs" title={r.url}>
                  {r.title || r.url}
                </span>
                {r.error && <span className="text-red-400 flex-shrink-0">{r.error}</span>}
              </div>
            ))
          ) : (
            failedUrls.map((url, i) => (
              <div key={i} className="px-3 py-1.5 text-xs text-gray-600 truncate border-b border-amber-100 last:border-b-0 font-mono" title={url}>
                {url}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
