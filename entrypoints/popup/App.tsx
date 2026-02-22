import { useState } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Link, List, Rss, BookOpen, History, MessageCircle } from 'lucide-react';
import type { ImportProgress } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SingleImport } from '@/components/SingleImport';
import { BatchImport } from '@/components/BatchImport';
import { RssImport } from '@/components/RssImport';
import { DocsImport } from '@/components/DocsImport';
import { ClaudeImport } from '@/components/ClaudeImport';
import { HistoryPanel } from '@/components/HistoryPanel';

export default function App() {
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  if (showHistory) {
    return <HistoryPanel onClose={() => setShowHistory(false)} />;
  }

  return (
    <div className="min-h-[480px] bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-notebooklm-blue flex items-center justify-center">
            <Link className="w-4 h-4 text-white" />
          </div>
          <span className="font-medium text-gray-900">NotebookLM Importer</span>
        </div>
        <button
          onClick={() => setShowHistory(true)}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="导入历史"
        >
          <History className="w-4 h-4" />
        </button>
      </div>

      {/* Progress indicator */}
      {importProgress && (
        <div className="px-4 py-2 bg-blue-50 border-b border-blue-100">
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-blue-700">
              正在导入 {importProgress.completed}/{importProgress.total}
            </span>
            {importProgress.current && (
              <span className="text-blue-500 truncate max-w-[200px]">
                {importProgress.current.url}
              </span>
            )}
          </div>
          <div className="w-full bg-blue-100 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{
                width: `${(importProgress.completed / importProgress.total) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs.Root defaultValue="single" className="flex flex-col">
        <Tabs.List className="flex border-b border-gray-100">
          {[
            { value: 'single', icon: Link, label: '单个导入' },
            { value: 'batch', icon: List, label: '批量导入' },
            { value: 'rss', icon: Rss, label: 'RSS' },
            { value: 'docs', icon: BookOpen, label: '文档站点' },
            { value: 'claude', icon: MessageCircle, label: 'Claude' },
          ].map(({ value, icon: Icon, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={cn(
                'flex-1 py-3 text-xs font-medium text-gray-500',
                'flex flex-col items-center gap-1 relative',
                'border-b-2 border-transparent',
                'hover:text-gray-700 hover:bg-gray-50',
                'data-[state=active]:text-notebooklm-blue data-[state=active]:border-notebooklm-blue'
              )}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="single" className="p-4">
          <SingleImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="batch" className="p-4">
          <BatchImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="rss" className="p-4">
          <RssImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="docs" className="p-4">
          <DocsImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="claude" className="p-4">
          <ClaudeImport onProgress={setImportProgress} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
