import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { ClaudeConversation, ClaudeMessage, ImportProgress } from '@/lib/types';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type ImportState = 'idle' | 'extracting' | 'ready' | 'importing' | 'success' | 'error';

export function ClaudeImport({ onProgress }: Props) {
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<ClaudeConversation | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isClaudePage, setIsClaudePage] = useState(false);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);

  // Check if current page is Claude
  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url?.startsWith('https://claude.ai/')) {
        setIsClaudePage(true);
        setCurrentTabId(tab.id || null);
      } else {
        setIsClaudePage(false);
      }
    });
  }, []);

  const handleExtract = async () => {
    if (!currentTabId) return;

    setState('extracting');
    setError('');

    // Inject content script first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: ['content-scripts/claude.js'],
      });
    } catch {
      // Script might already be injected
    }

    // Wait a bit for script to initialize
    await new Promise((resolve) => setTimeout(resolve, 300));

    chrome.runtime.sendMessage(
      { type: 'EXTRACT_CLAUDE_CONVERSATION', tabId: currentTabId },
      (response) => {
        if (response?.success && response.data) {
          const conv = response.data as ClaudeConversation;
          setConversation(conv);
          // Select all messages by default
          setSelectedIds(new Set(conv.messages.map((m) => m.id)));
          setState('ready');
        } else {
          setState('error');
          setError(response?.error || '提取对话失败');
        }
      }
    );
  };

  const handleToggleMessage = (messageId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (conversation) {
      setSelectedIds(new Set(conversation.messages.map((m) => m.id)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleImport = async () => {
    if (!conversation || selectedIds.size === 0) return;

    setState('importing');
    setError('');

    onProgress({
      total: 1,
      completed: 0,
      items: [{ url: conversation.url, status: 'importing' }],
    });

    chrome.runtime.sendMessage(
      {
        type: 'IMPORT_CLAUDE_CONVERSATION',
        conversation,
        selectedMessageIds: Array.from(selectedIds),
      },
      (response) => {
        onProgress(null);

        if (response?.success && response.data) {
          setState('success');
          setTimeout(() => setState('ready'), 3000);
        } else {
          setState('error');
          setError(response?.error || '导入失败，请确保 NotebookLM 页面已打开');
        }
      }
    );
  };

  const allSelected = Boolean(
    conversation && selectedIds.size === conversation.messages.length
  );
  const noneSelected = selectedIds.size === 0;

  // Not on Claude page
  if (!isClaudePage) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 rounded-lg p-4 text-center">
          <MessageCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
          <p className="text-sm text-yellow-700">请先打开 Claude 对话页面</p>
          <p className="text-xs text-yellow-600 mt-1">访问 claude.ai 并打开一个对话</p>
        </div>
      </div>
    );
  }

  // Initial state - show extract button
  if (state === 'idle' || state === 'extracting' || (state === 'error' && !conversation)) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleExtract}
          disabled={state === 'extracting'}
          className="w-full py-3 bg-notebooklm-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {state === 'extracting' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              正在提取对话...
            </>
          ) : (
            <>
              <MessageCircle className="w-4 h-4" />
              提取当前对话
            </>
          )}
        </button>

        {state === 'error' && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="text-xs text-gray-400 space-y-1">
          <p>使用说明：</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>在 claude.ai 打开对话页面</li>
            <li>点击"提取当前对话"按钮</li>
            <li>选择要导入的消息</li>
            <li>点击导入到 NotebookLM</li>
          </ol>
        </div>
      </div>
    );
  }

  // Show conversation with message selection
  return (
    <div className="space-y-4">
      {/* Conversation header */}
      <div className="bg-gray-50 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 truncate">
            {conversation?.title}
          </h3>
          <button
            onClick={handleExtract}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded"
            title="重新提取"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        <p className="text-xs text-gray-500">
          共 {conversation?.messages.length || 0} 条消息，已选择 {selectedIds.size} 条
        </p>
      </div>

      {/* Selection controls */}
      <div className="flex gap-2">
        <button
          onClick={handleSelectAll}
          disabled={allSelected}
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          全选
        </button>
        <button
          onClick={handleDeselectAll}
          disabled={noneSelected}
          className="flex-1 px-3 py-1.5 text-xs border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          取消全选
        </button>
      </div>

      {/* Message list */}
      <div className="max-h-[200px] overflow-y-auto border border-gray-100 rounded-lg">
        {conversation?.messages.map((message) => (
          <MessageItem
            key={message.id}
            message={message}
            selected={selectedIds.has(message.id)}
            onToggle={() => handleToggleMessage(message.id)}
          />
        ))}
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={state === 'importing' || selectedIds.size === 0}
        className="w-full py-2.5 bg-notebooklm-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {state === 'importing' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            导入中...
          </>
        ) : (
          `导入选中的 ${selectedIds.size} 条消息`
        )}
      </button>

      {/* Status messages */}
      {state === 'success' && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-lg p-3">
          <CheckCircle className="w-4 h-4" />
          导入成功！
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

// Message item component
function MessageItem({
  message,
  selected,
  onToggle,
}: {
  message: ClaudeMessage;
  selected: boolean;
  onToggle: () => void;
}) {
  const roleIcon = message.role === 'human' ? '👤' : '🤖';
  const roleLabel = message.role === 'human' ? 'Human' : 'Claude';
  const preview =
    message.content.length > 80
      ? message.content.slice(0, 80) + '...'
      : message.content;

  return (
    <label className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0">
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="mt-1 rounded border-gray-300 text-notebooklm-blue focus:ring-notebooklm-blue"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-1">
          <span>{roleIcon}</span>
          <span className="text-xs font-medium text-gray-700">{roleLabel}</span>
          {message.timestamp && (
            <span className="text-xs text-gray-400">{message.timestamp}</span>
          )}
        </div>
        <p className="text-xs text-gray-500 line-clamp-2">{preview}</p>
      </div>
    </label>
  );
}
