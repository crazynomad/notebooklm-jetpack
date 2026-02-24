import { useState, useEffect } from 'react';
import { History, Trash2, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import type { HistoryItem } from '@/lib/types';
import { t } from '@/lib/i18n';

interface Props {
  onClose: () => void;
}

export function HistoryPanel({ onClose }: Props) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = () => {
    setLoading(true);
    chrome.runtime.sendMessage({ type: 'GET_HISTORY', limit: 50 }, (response) => {
      setLoading(false);
      if (response?.success && Array.isArray(response.data)) {
        setHistory(response.data as HistoryItem[]);
      }
    });
  };

  const handleClearHistory = () => {
    if (!confirm(t('history.confirmClear'))) return;

    chrome.runtime.sendMessage({ type: 'CLEAR_HISTORY' }, (response) => {
      if (response?.success) {
        setHistory([]);
      }
    });
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();

    // Less than 1 minute
    if (diff < 60 * 1000) {
      return t('history.justNow');
    }
    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      return t('history.minutesAgo', { count: Math.floor(diff / (60 * 1000)) });
    }
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      return t('history.hoursAgo', { count: Math.floor(diff / (60 * 60 * 1000)) });
    }
    // Otherwise show date
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDomain = (url: string) => {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  return (
    <div className="fixed inset-0 bg-surface z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="glass px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-notebooklm-blue" />
          <span className="font-medium text-gray-900 tracking-tight">{t('history.title')}</span>
          <span className="text-xs text-gray-400">({history.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="btn-press p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
              title={t('history.clearHistory')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="btn-press px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-150"
          >
            {t('close')}
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-notebooklm-blue/60 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <History className="w-12 h-12 text-gray-300/40 mb-4" />
            <p className="text-sm text-gray-500 font-medium">{t('history.noRecords')}</p>
            <p className="text-xs text-gray-400 mt-1">{t('history.recordsHint')}</p>
          </div>
        ) : (
          <div className="divide-y divide-border-subtle">
            {history.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-surface-sunken flex items-start gap-3"
              >
                {item.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 font-mono">{getDomain(item.url)}</span>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-400 hover:text-notebooklm-blue"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-sm text-gray-700 truncate" title={item.url}>
                    {item.title || item.url}
                  </p>
                  {item.error && (
                    <p className="text-xs text-red-500 mt-0.5">{item.error}</p>
                  )}
                </div>
                <span className="text-xs text-gray-400 flex-shrink-0 font-mono tabular-nums">
                  {formatTime(item.importedAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
