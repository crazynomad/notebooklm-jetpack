import { useState, useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { Youtube, Link, List, Rss, Loader2, CheckCircle, AlertCircle, BookOpen } from 'lucide-react';
import { CHANNEL_CONFIG } from '@/lib/config';
import type { SubscriptionStatus, ImportProgress } from '@/lib/types';
import { cn } from '@/lib/utils';
import { SingleImport } from '@/components/SingleImport';
import { BatchImport } from '@/components/BatchImport';
import { PlaylistImport } from '@/components/PlaylistImport';
import { RssImport } from '@/components/RssImport';
import { DocsImport } from '@/components/DocsImport';

type CheckState = 'idle' | 'checking' | 'subscribed' | 'not_subscribed' | 'error';

export default function App() {
  const [checkState, setCheckState] = useState<CheckState>('idle');
  const [error, setError] = useState<string>('');
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);

  useEffect(() => {
    // Check cached subscription first
    chrome.runtime.sendMessage({ type: 'GET_CACHED_SUBSCRIPTION' }, (response) => {
      if (response?.success && response.data) {
        setCheckState(response.data.isSubscribed ? 'subscribed' : 'not_subscribed');
      } else {
        // No cache, need to verify
        setCheckState('idle');
      }
    });
  }, []);

  const handleCheckSubscription = () => {
    setCheckState('checking');
    setError('');

    chrome.runtime.sendMessage({ type: 'CHECK_SUBSCRIPTION' }, (response) => {
      if (response?.success) {
        const status = response.data as SubscriptionStatus;
        setCheckState(status.isSubscribed ? 'subscribed' : 'not_subscribed');
      } else {
        setCheckState('error');
        setError(response?.error || '验证失败，请重试');
      }
    });
  };

  const handleSubscribe = () => {
    chrome.tabs.create({ url: CHANNEL_CONFIG.subscribeUrl });
  };

  // Not subscribed view
  if (checkState !== 'subscribed') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[480px] p-6 bg-gradient-to-b from-red-50 to-white">
        <div className="w-20 h-20 rounded-full bg-youtube-red flex items-center justify-center mb-6">
          <Youtube className="w-10 h-10 text-white" />
        </div>

        <h1 className="text-xl font-bold text-gray-900 mb-2">NotebookLM Importer</h1>
        <p className="text-sm text-gray-500 mb-6 text-center">社群版 - 需订阅解锁</p>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 mb-6 w-full">
          <p className="text-sm text-gray-600 mb-3">
            订阅「<span className="font-medium text-youtube-red">{CHANNEL_CONFIG.name}</span>
            」频道即可免费使用全部功能：
          </p>
          <ul className="text-sm text-gray-500 space-y-2">
            <li className="flex items-center gap-2">
              <Link className="w-4 h-4" />
              一键导入当前网页
            </li>
            <li className="flex items-center gap-2">
              <List className="w-4 h-4" />
              批量导入多个 URL
            </li>
            <li className="flex items-center gap-2">
              <Youtube className="w-4 h-4" />
              YouTube 播放列表导入
            </li>
            <li className="flex items-center gap-2">
              <Rss className="w-4 h-4" />
              RSS 源文章导入
            </li>
            <li className="flex items-center gap-2">
              <BookOpen className="w-4 h-4" />
              文档站点批量导入
            </li>
          </ul>
        </div>

        {checkState === 'idle' && (
          <button
            onClick={handleCheckSubscription}
            className="w-full py-3 px-4 bg-notebooklm-blue text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            验证订阅状态
          </button>
        )}

        {checkState === 'checking' && (
          <button
            disabled
            className="w-full py-3 px-4 bg-gray-100 text-gray-400 rounded-lg font-medium flex items-center justify-center gap-2"
          >
            <Loader2 className="w-4 h-4 animate-spin" />
            正在验证...
          </button>
        )}

        {checkState === 'not_subscribed' && (
          <div className="w-full space-y-3">
            <button
              onClick={handleSubscribe}
              className="w-full py-3 px-4 bg-youtube-red text-white rounded-lg font-medium hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              <Youtube className="w-4 h-4" />
              订阅频道
            </button>
            <button
              onClick={handleCheckSubscription}
              className="w-full py-2 px-4 text-notebooklm-blue text-sm hover:underline"
            >
              已订阅？点击重新验证
            </button>
          </div>
        )}

        {checkState === 'error' && (
          <div className="w-full space-y-3">
            <div className="flex items-center gap-2 text-red-500 text-sm">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
            <button
              onClick={handleCheckSubscription}
              className="w-full py-3 px-4 bg-notebooklm-blue text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              重试
            </button>
          </div>
        )}
      </div>
    );
  }

  // Subscribed view - main functionality
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
        <div className="flex items-center gap-1 text-xs text-green-600">
          <CheckCircle className="w-3 h-3" />
          已解锁
        </div>
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
            { value: 'playlist', icon: Youtube, label: '播放列表' },
            { value: 'rss', icon: Rss, label: 'RSS' },
            { value: 'docs', icon: BookOpen, label: '文档站点' },
          ].map(({ value, icon: Icon, label }) => (
            <Tabs.Trigger
              key={value}
              value={value}
              className={cn(
                'flex-1 py-3 text-xs font-medium text-gray-500',
                'flex flex-col items-center gap-1',
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

        <Tabs.Content value="playlist" className="p-4">
          <PlaylistImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="rss" className="p-4">
          <RssImport onProgress={setImportProgress} />
        </Tabs.Content>

        <Tabs.Content value="docs" className="p-4">
          <DocsImport onProgress={setImportProgress} />
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
