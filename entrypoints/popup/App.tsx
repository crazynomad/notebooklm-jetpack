import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { BookOpen, History, MessageCircle, Headphones, MoreHorizontal, Bookmark } from 'lucide-react';
import type { ImportProgress } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DocsImport } from '@/components/DocsImport';
import { PodcastImport } from '@/components/PodcastImport';
import { ClaudeImport } from '@/components/ClaudeImport';
import { MorePanel } from '@/components/MorePanel';
import { BookmarkPanel } from '@/components/BookmarkPanel';
import { HistoryPanel } from '@/components/HistoryPanel';
import { RescueBanner } from '@/components/RescueBanner';

export default function App() {
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [activeTab, setActiveTab] = useState('docs');
  const [initialPodcastUrl, setInitialPodcastUrl] = useState('');
  const [notebookLMTabId, setNotebookLMTabId] = useState<number | null>(null);

  // Auto-detect URL from current tab
  useState(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      const tabId = tabs[0]?.id;
      if (/podcasts\.apple\.com\//.test(url) || /xiaoyuzhoufm\.com\/(episode|podcast)\//.test(url)) {
        setActiveTab('podcast');
        setInitialPodcastUrl(url);
      } else if (/claude\.ai\/|chatgpt\.com\/|chat\.openai\.com\/|gemini\.google\.com\//.test(url)) {
        setActiveTab('claude');
      }
      if (/notebooklm\.google\.com/.test(url) && tabId) {
        setNotebookLMTabId(tabId);
      }
    });
  });

  if (showHistory) {
    return <HistoryPanel onClose={() => setShowHistory(false)} />;
  }

  return (
    <div className="min-h-[480px] bg-gray-50/40">
      {/* Header */}
      <div className="px-3.5 py-2.5 bg-white border-b border-gray-100/80 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-notebooklm-blue to-blue-600 flex items-center justify-center shadow-sm">
            <BookOpen className="w-3.5 h-3.5 text-white" />
          </div>
          <div>
            <span className="font-semibold text-[13px] text-gray-900 tracking-tight">NotebookLM Jetpack</span>
            <span className="text-[9px] text-gray-400 ml-1.5" title={`Build: ${__BUILD_TIME__}`}>v{__VERSION__}</span>
          </div>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="p-1.5 text-gray-400 hover:text-notebooklm-blue hover:bg-blue-50 rounded-lg transition-all duration-150"
          title="导入历史"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      {/* Progress indicator */}
      {importProgress && (
        <div className="px-4 py-2.5 bg-blue-50/80 border-b border-blue-100/60">
          <div className="flex items-center justify-between text-sm mb-1.5">
            <span className="text-blue-700 font-medium text-xs">
              正在导入 {importProgress.completed}/{importProgress.total}
            </span>
            {importProgress.current && (
              <span className="text-blue-400 truncate max-w-[200px] text-xs">
                {importProgress.current.url}
              </span>
            )}
          </div>
          <div className="w-full bg-blue-100/80 rounded-full h-1">
            <div
              className="bg-gradient-to-r from-notebooklm-blue to-blue-500 h-1 rounded-full transition-all duration-300"
              style={{
                width: `${(importProgress.completed / importProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Rescue banner — shown when on NotebookLM page */}
      {notebookLMTabId && <RescueBanner tabId={notebookLMTabId} />}

      {/* Tabs */}
      <Tabs.Root value={activeTab} onValueChange={setActiveTab} className="flex flex-col">
        <Tabs.List className="flex bg-white border-b border-gray-100/80 px-1.5 gap-0.5">
          {[
            { value: 'docs', icon: BookOpen, label: '文档站' },
            { value: 'podcast', icon: Headphones, label: '播客' },
            { value: 'claude', icon: MessageCircle, label: 'AI 对话' },
            { value: 'bookmark', icon: Bookmark, label: '收藏' },
            { value: 'more', icon: MoreHorizontal, label: '更多' },
          ].map(({ value, icon: Icon, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={cn(
                'flex-1 py-2 text-[11px] font-medium text-gray-400',
                'flex flex-col items-center gap-0.5 relative',
                'border-b-2 border-transparent',
                'hover:text-gray-500 rounded-t',
                'transition-all duration-150',
                'data-[state=active]:text-notebooklm-blue data-[state=active]:border-notebooklm-blue',
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="docs" className="p-4 animate-fade-in">
          <DocsImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="podcast" className="p-4 animate-fade-in">
          <PodcastImport initialUrl={initialPodcastUrl} />
        </Tabs.Content>

        <Tabs.Content value="claude" className="p-4 animate-fade-in">
          <ClaudeImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="bookmark" className="p-4 animate-fade-in">
          <BookmarkPanel onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="more" className="p-4 animate-fade-in">
          <MorePanel onProgress={setImportProgress} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
