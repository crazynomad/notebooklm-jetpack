import { useState, useEffect } from 'react';
import {
  MessageCircle,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import type { ClaudeConversation, QAPair, ImportProgress } from '@/lib/types';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type ImportState = 'idle' | 'extracting' | 'ready' | 'importing' | 'success' | 'error';
type AIPlatform = 'claude' | 'chatgpt' | 'gemini' | null;

const PLATFORM_CONFIG: Record<string, { name: string; platform: AIPlatform; script: string; icon: string }> = {
  'claude.ai': { name: 'Claude', platform: 'claude', script: 'content-scripts/claude.js', icon: '🟤' },
  'chatgpt.com': { name: 'ChatGPT', platform: 'chatgpt', script: 'content-scripts/chatgpt.js', icon: '🟢' },
  'chat.openai.com': { name: 'ChatGPT', platform: 'chatgpt', script: 'content-scripts/chatgpt.js', icon: '🟢' },
  'gemini.google.com': { name: 'Gemini', platform: 'gemini', script: 'content-scripts/gemini.js', icon: '🔵' },
};

function detectPlatform(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return PLATFORM_CONFIG[hostname] || null;
  } catch {
    return null;
  }
}

export function ClaudeImport({ onProgress }: Props) {
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState('');
  const [conversation, setConversation] = useState<ClaudeConversation | null>(null);
  const [selectedPairIds, setSelectedPairIds] = useState<Set<string>>(new Set());
  const [platformInfo, setPlatformInfo] = useState<ReturnType<typeof detectPlatform>>(null);
  const [currentTabId, setCurrentTabId] = useState<number | null>(null);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url) {
        const info = detectPlatform(tab.url);
        setPlatformInfo(info);
        setCurrentTabId(info ? (tab.id || null) : null);
      }
    });
  }, []);

  const handleExtract = async () => {
    if (!currentTabId || !platformInfo) return;

    setState('extracting');
    setError('');

    try {
      await chrome.scripting.executeScript({
        target: { tabId: currentTabId },
        files: [platformInfo.script],
      });
    } catch { /* already injected */ }

    await new Promise((resolve) => setTimeout(resolve, 300));

    chrome.runtime.sendMessage(
      { type: 'EXTRACT_CLAUDE_CONVERSATION', tabId: currentTabId },
      (response) => {
        if (response?.success && response.data) {
          const conv = response.data as ClaudeConversation;
          setConversation(conv);
          const pairs = conv.pairs || [];
          setSelectedPairIds(new Set(pairs.map((p) => p.id)));
          setState('ready');
        } else {
          setState('error');
          setError(response?.error || '提取对话失败');
        }
      }
    );
  };

  const handleImport = async () => {
    if (!conversation) return;
    const pairs = conversation.pairs || [];
    const selected = pairs.filter((p) => selectedPairIds.has(p.id));
    if (selected.length === 0) return;

    setState('importing');
    setError('');

    // Check for NotebookLM tab
    const nlmTabs = await chrome.tabs.query({ url: 'https://notebooklm.google.com/*' });
    if (nlmTabs.length === 0) {
      setState('error');
      setError('请先打开 NotebookLM 笔记本页面，然后再导入');
      return;
    }

    // Use the first NotebookLM tab
    const nlmTab = nlmTabs[0];
    if (!nlmTab.id) {
      setState('error');
      setError('无法获取 NotebookLM 标签页');
      return;
    }

    // Check if it's a notebook page (has notebook ID in URL)
    if (!/\/notebook\//.test(nlmTab.url || '')) {
      setState('error');
      setError('请先打开一个 NotebookLM 笔记本（而非首页），然后再导入');
      return;
    }

    // Detect platform name
    const platformName = platformInfo?.name || 'AI';

    // Format content as markdown (rescue-style: title + text import)
    const content = formatPairsForImport(conversation.title, conversation.url, platformName, selected);
    const title = conversation.title;

    onProgress({
      total: 1,
      completed: 0,
      items: [{ url: conversation.url, status: 'importing' }],
    });

    chrome.runtime.sendMessage(
      {
        type: 'IMPORT_CLAUDE_CONVERSATION',
        conversation: { ...conversation, pairs: selected },
        selectedMessageIds: [], // Not used in new flow
      },
      (response) => {
        onProgress(null);
        if (response?.success) {
          setState('success');
          setTimeout(() => setState('ready'), 3000);
        } else {
          setState('error');
          setError(response?.error || '导入失败');
        }
      }
    );
  };

  const togglePair = (id: string) => {
    setSelectedPairIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pairs = conversation?.pairs || [];
  const allSelected = pairs.length > 0 && selectedPairIds.size === pairs.length;

  // Not on a supported AI platform
  if (!platformInfo) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50/60 border border-amber-200/40 rounded-xl p-4 shadow-soft text-center">
          <MessageCircle className="w-10 h-10 text-amber-500 opacity-80 mx-auto mb-2" />
          <p className="text-sm text-amber-700 leading-relaxed">请先打开 AI 对话页面</p>
          <p className="text-xs text-amber-600/70 mt-2">支持：Claude · ChatGPT · Gemini</p>
        </div>
      </div>
    );
  }

  // Initial / extracting state
  if (state === 'idle' || state === 'extracting' || (state === 'error' && !conversation)) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleExtract}
          disabled={state === 'extracting'}
          className="w-full py-3 bg-notebooklm-blue text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
        >
          {state === 'extracting' ? (
            <><Loader2 className="w-4 h-4 animate-spin" />正在提取对话...</>
          ) : (
            <><MessageCircle className="w-4 h-4" />提取当前对话</>
          )}
        </button>

        {state === 'error' && (
          <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100/60 rounded-lg p-3 shadow-soft">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="text-xs text-gray-400 space-y-1 bg-surface-sunken rounded-xl p-3.5">
          <p>当前平台：{platformInfo.icon} {platformInfo.name}</p>
          <p className="mt-1">使用说明：</p>
          <ol className="list-decimal list-inside space-y-0.5">
            <li>在 {platformInfo.name} 打开对话页面</li>
            <li>点击「提取当前对话」</li>
            <li>选择要导入的问答对</li>
            <li>点击导入到 NotebookLM</li>
          </ol>
        </div>
      </div>
    );
  }

  // Ready state — show Q&A pairs
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-surface-sunken rounded-xl p-3 shadow-soft">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-gray-900 truncate flex items-center gap-2">
            <span>{platformInfo.icon}</span>
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
          共 {pairs.length} 个问答对，已选择 <span className="font-mono tabular-nums">{selectedPairIds.size}</span> 个
        </p>
      </div>

      {/* Selection controls */}
      <div className="flex gap-2">
        <button
          onClick={() => setSelectedPairIds(new Set(pairs.map((p) => p.id)))}
          disabled={allSelected}
          className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150 btn-press"
        >
          全选
        </button>
        <button
          onClick={() => setSelectedPairIds(new Set())}
          disabled={selectedPairIds.size === 0}
          className="flex-1 px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors duration-150 btn-press"
        >
          取消全选
        </button>
      </div>

      {/* Q&A pair list */}
      <div className="max-h-[240px] overflow-y-auto border border-border-strong rounded-lg shadow-soft">
        {pairs.map((pair, index) => (
          <label
            key={pair.id}
            className="flex items-start gap-3 p-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100/80 last:border-b-0"
          >
            <input
              type="checkbox"
              checked={selectedPairIds.has(pair.id)}
              onChange={() => togglePair(pair.id)}
              className="mt-1 rounded border-gray-300 text-notebooklm-blue focus:ring-notebooklm-blue"
            />
            <div className="flex-1 min-w-0 space-y-1">
                <p className="text-xs text-gray-700 line-clamp-2">
                  <span className="text-xs font-mono tabular-nums text-gray-400 mr-1">#{index + 1}</span>
                  <span className="text-gray-400">Q：</span>
                  {pair.question || '(无问题)'}
                </p>
                <p className="text-xs text-gray-500 line-clamp-2">
                  <span className="text-gray-400">A：</span>
                  {pair.answer.slice(0, 100) || '(无回答)'}
                  {pair.answer.length > 100 && '...'}
                </p>
            </div>
          </label>
        ))}
      </div>

      {/* Import button */}
      <button
        onClick={handleImport}
        disabled={state === 'importing' || selectedPairIds.size === 0}
        className="w-full py-2.5 bg-notebooklm-blue text-white rounded-lg hover:bg-notebooklm-blue/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
      >
        {state === 'importing' ? (
          <><Loader2 className="w-4 h-4 animate-spin" />导入中...</>
        ) : (
          <>导入选中的 <span className="font-mono tabular-nums">{selectedPairIds.size}</span> 个问答对</>
        )}
      </button>

      {/* Status */}
      {state === 'success' && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 border border-green-100/60 rounded-lg p-3 shadow-soft">
          <CheckCircle className="w-4 h-4" />
          导入成功！
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 border border-red-100/60 rounded-lg p-3 shadow-soft">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}
    </div>
  );
}

/** Format selected Q&A pairs as markdown for text import */
function formatPairsForImport(
  title: string,
  url: string,
  platform: string,
  pairs: QAPair[]
): string {
  const lines: string[] = [];
  lines.push(`# ${title}`);
  lines.push('');
  lines.push(`**来源**: ${platform} 对话`);
  lines.push(`**URL**: ${url}`);
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const pair of pairs) {
    if (pair.question) {
      lines.push('## 👤 Human');
      lines.push('');
      lines.push(pair.question);
      lines.push('');
    }
    if (pair.answer) {
      lines.push(`## 🤖 ${platform}`);
      lines.push('');
      lines.push(pair.answer);
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}
