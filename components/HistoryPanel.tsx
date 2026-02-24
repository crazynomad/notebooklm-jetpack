import { useState, useEffect } from 'react';
import { History, Trash2, CheckCircle, XCircle, ExternalLink, Loader2 } from 'lucide-react';
import type { HistoryItem } from '@/lib/types';

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
    if (!confirm('确定要清除所有导入历史吗？')) return;

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
      return '刚刚';
    }
    // Less than 1 hour
    if (diff < 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 1000))} 分钟前`;
    }
    // Less than 24 hours
    if (diff < 24 * 60 * 60 * 1000) {
      return `${Math.floor(diff / (60 * 60 * 1000))} 小时前`;
    }
    // Otherwise show date
    return date.toLocaleDateString('zh-CN', {
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
    <div className="fixed inset-0 bg-white z-50 flex flex-col animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <History className="w-5 h-5 text-notebooklm-blue" />
          <span className="font-medium text-gray-900">导入历史</span>
          <span className="text-xs text-gray-400">({history.length})</span>
        </div>
        <div className="flex items-center gap-2">
          {history.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all duration-150"
              title="清除历史"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all duration-150"
          >
            关闭
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <History className="w-10 h-10 mb-3 opacity-30" />
            <p className="text-sm text-gray-400">暂无导入记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {history.map((item) => (
              <div
                key={item.id}
                className="px-4 py-3 hover:bg-gray-50 flex items-start gap-3"
              >
                {item.status === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400">{getDomain(item.url)}</span>
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
                <span className="text-xs text-gray-400 flex-shrink-0">
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
