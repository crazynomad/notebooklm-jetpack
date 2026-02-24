import { useState, useEffect } from 'react';
import {
  Bookmark,
  BookmarkPlus,
  Loader2,
  CheckCircle,
  AlertCircle,
  Trash2,
  FileDown,
  BookOpen,
  FolderPlus,
  ChevronDown,
  ChevronUp,
  X,
} from 'lucide-react';
import type { ImportProgress } from '@/lib/types';
import type { BookmarkItem } from '@/services/bookmarks';
import type { PdfProgress } from '@/services/pdf-generator';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type PanelState = 'idle' | 'loading' | 'importing' | 'exporting' | 'success' | 'error';

export function BookmarkPanel({ onProgress }: Props) {
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>([]);
  const [collections, setCollections] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeCollection, setActiveCollection] = useState<string>('all');
  const [state, setState] = useState<PanelState>('idle');
  const [error, setError] = useState('');
  const [currentTabInfo, setCurrentTabInfo] = useState<{ url: string; title: string; favicon?: string } | null>(null);
  const [isCurrentBookmarked, setIsCurrentBookmarked] = useState(false);
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState('');
  const [pdfState, setPdfState] = useState<'idle' | 'fetching' | 'generating' | 'done'>('idle');
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);

  // Load bookmarks and current tab info
  useEffect(() => {
    loadData();
    loadCurrentTab();
  }, []);

  const loadData = () => {
    chrome.runtime.sendMessage({ type: 'GET_BOOKMARKS' }, (resp) => {
      if (resp?.success) setBookmarks(resp.data || []);
    });
    chrome.runtime.sendMessage({ type: 'GET_COLLECTIONS' }, (resp) => {
      if (resp?.success) setCollections(resp.data || []);
    });
  };

  const loadCurrentTab = () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      if (tab?.url?.startsWith('http') && !/notebooklm\.google\.com/.test(tab.url)) {
        setCurrentTabInfo({
          url: tab.url,
          title: tab.title || tab.url,
          favicon: tab.favIconUrl,
        });
        chrome.runtime.sendMessage({ type: 'IS_BOOKMARKED', url: tab.url }, (resp) => {
          if (resp?.success) setIsCurrentBookmarked(resp.data);
        });
      }
    });
  };

  const handleAddBookmark = (collection?: string) => {
    if (!currentTabInfo) return;
    chrome.runtime.sendMessage(
      { type: 'ADD_BOOKMARK', url: currentTabInfo.url, title: currentTabInfo.title, favicon: currentTabInfo.favicon, collection },
      (resp) => {
        if (resp?.success) {
          setIsCurrentBookmarked(true);
          loadData();
        }
      }
    );
  };

  const handleRemove = (id: string) => {
    chrome.runtime.sendMessage({ type: 'REMOVE_BOOKMARK', id }, () => {
      setSelectedIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      loadData();
      if (currentTabInfo) {
        chrome.runtime.sendMessage({ type: 'IS_BOOKMARKED', url: currentTabInfo.url }, (resp) => {
          if (resp?.success) setIsCurrentBookmarked(resp.data);
        });
      }
    });
  };

  const handleRemoveSelected = () => {
    if (selectedIds.size === 0) return;
    chrome.runtime.sendMessage({ type: 'REMOVE_BOOKMARKS', ids: Array.from(selectedIds) }, () => {
      setSelectedIds(new Set());
      loadData();
    });
  };

  const handleCreateCollection = () => {
    if (!newCollectionName.trim()) return;
    chrome.runtime.sendMessage({ type: 'CREATE_COLLECTION', name: newCollectionName.trim() }, () => {
      setNewCollectionName('');
      setShowNewCollection(false);
      loadData();
    });
  };

  const handleExportPdf = () => {
    const items = filteredBookmarks.filter((b) => selectedIds.has(b.id));
    if (items.length === 0) return;

    setPdfState('fetching');
    setPdfProgress(null);
    setError('');

    const siteInfo = {
      title: activeCollection === 'all' ? '收藏合集' : activeCollection,
      baseUrl: '',
      framework: 'unknown' as const,
      pages: items.map((b) => ({ url: b.url, title: b.title, path: b.url })),
    };

    const port = chrome.runtime.connect({ name: 'pdf-export' });
    port.postMessage({ type: 'GENERATE_PDF', siteInfo });

    port.onMessage.addListener((msg) => {
      if (msg.phase === 'fetching') {
        setPdfState('fetching');
        setPdfProgress({ phase: 'fetching', current: msg.current, total: msg.total, currentPage: msg.currentPage });
      } else if (msg.phase === 'rendering') {
        setPdfState('generating');
        setPdfProgress({ phase: 'rendering', current: 1, total: 1 });
      } else if (msg.phase === 'done') {
        setPdfState('done');
        port.disconnect();
      } else if (msg.phase === 'error') {
        setState('error');
        setError(msg.error || 'PDF 生成失败');
        setPdfState('idle');
        port.disconnect();
      }
    });

    port.onDisconnect.addListener(() => {
      if (pdfState !== 'done') setPdfState('done');
    });
  };

  const handleImportToNotebookLM = () => {
    const items = filteredBookmarks.filter((b) => selectedIds.has(b.id));
    if (items.length === 0) return;

    setState('importing');
    setError('');
    const urls = items.map((b) => b.url);

    onProgress({ total: urls.length, completed: 0, items: urls.map((u) => ({ url: u, status: 'pending' as const })) });

    chrome.runtime.sendMessage({ type: 'RESCUE_SOURCES', urls }, (resp) => {
      onProgress(null);
      if (resp?.success) {
        setState('success');
        setTimeout(() => setState('idle'), 3000);
      } else {
        setState('error');
        setError(resp?.error || '导入失败');
      }
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const filteredBookmarks = activeCollection === 'all'
    ? bookmarks
    : bookmarks.filter((b) => b.collection === activeCollection);

  const selectAll = () => setSelectedIds(new Set(filteredBookmarks.map((b) => b.id)));
  const deselectAll = () => setSelectedIds(new Set());

  return (
    <div className="space-y-3">
      {/* Add current page */}
      {currentTabInfo && (
        <div className="bg-gray-50/80 rounded-lg p-3 shadow-soft">
          <div className="flex items-center gap-2">
            {currentTabInfo.favicon && (
              <img src={currentTabInfo.favicon} className="w-4 h-4 flex-shrink-0" alt="" />
            )}
            <span className="flex-1 text-sm text-gray-700 truncate">{currentTabInfo.title}</span>
            {isCurrentBookmarked ? (
              <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50/80 px-2 py-1 rounded-md">
                <Bookmark className="w-3 h-3 fill-current" />
                已收藏
              </span>
            ) : (
              <button
                onClick={() => handleAddBookmark()}
                className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white text-xs rounded-md hover:bg-amber-600 transition-colors shadow-btn hover:shadow-btn-hover transition-all duration-150"
              >
                <BookmarkPlus className="w-3 h-3" />
                收藏
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collection tabs */}
      {collections.length > 0 && (
        <div className="flex items-center gap-1 overflow-x-auto">
          <button
            onClick={() => { setActiveCollection('all'); deselectAll(); }}
            className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
              activeCollection === 'all' ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200'
            }`}
          >
            全部 ({bookmarks.length})
          </button>
          {collections.map((col) => {
            const count = bookmarks.filter((b) => b.collection === col).length;
            return (
              <button
                key={col}
                onClick={() => { setActiveCollection(col); deselectAll(); }}
                className={`px-2.5 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${
                  activeCollection === col ? 'bg-amber-500 text-white shadow-sm' : 'bg-gray-100/80 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {col} ({count})
              </button>
            );
          })}
          <button
            onClick={() => setShowNewCollection(!showNewCollection)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="新建集合"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* New collection input */}
      {showNewCollection && (
        <div className="flex gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="集合名称"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            onKeyDown={(e) => { if (e.key === 'Enter') handleCreateCollection(); }}
          />
          <button onClick={handleCreateCollection} className="px-3 py-1.5 bg-amber-500 text-white text-xs rounded-lg hover:bg-amber-600">
            创建
          </button>
          <button onClick={() => setShowNewCollection(false)} className="p-1.5 text-gray-400 hover:text-gray-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Bookmark list */}
      {filteredBookmarks.length > 0 ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">
              {selectedIds.size > 0 ? `已选 ${selectedIds.size} 项` : `共 ${filteredBookmarks.length} 项`}
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={selectAll} className="text-amber-600 hover:underline">全选</button>
              <button onClick={deselectAll} className="text-gray-400 hover:underline">取消</button>
              {selectedIds.size > 0 && (
                <button onClick={handleRemoveSelected} className="text-red-400 hover:text-red-600">删除选中</button>
              )}
            </div>
          </div>

          <div className="max-h-[200px] overflow-y-auto border border-gray-200/80 rounded-lg shadow-soft">
            {filteredBookmarks.map((item) => (
              <label
                key={item.id}
                className="flex items-center gap-2 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-50 last:border-b-0"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                />
                {item.favicon && <img src={item.favicon} className="w-4 h-4 flex-shrink-0" alt="" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700 truncate">{item.title}</p>
                  <p className="text-[10px] text-gray-400 truncate">{item.url}</p>
                </div>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(item.id); }}
                  className="p-1 text-gray-300 hover:text-red-500 flex-shrink-0"
                  title="删除"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </label>
            ))}
          </div>

          {/* Action buttons */}
          {selectedIds.size > 0 && (
            <div className="space-y-2">
              <button
                onClick={handleExportPdf}
                disabled={pdfState === 'fetching' || pdfState === 'generating' || state === 'importing'}
                className="w-full py-2 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150"
              >
                {pdfState === 'fetching' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />抓取页面 {pdfProgress?.current || 0}/{pdfProgress?.total || selectedIds.size}...</>
                ) : pdfState === 'generating' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />生成 PDF...</>
                ) : pdfState === 'done' ? (
                  <><CheckCircle className="w-4 h-4" />PDF 已下载</>
                ) : (
                  <><FileDown className="w-4 h-4" />聚合导出 PDF ({selectedIds.size} 篇)</>
                )}
              </button>

              <button
                onClick={handleImportToNotebookLM}
                disabled={state === 'importing' || pdfState === 'fetching' || pdfState === 'generating'}
                className="w-full py-2 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150"
              >
                {state === 'importing' ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />导入中...</>
                ) : (
                  <><BookOpen className="w-4 h-4" />导入 NotebookLM ({selectedIds.size} 篇)</>
                )}
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="text-center py-8 bg-gray-50/30 rounded-lg">
          <Bookmark className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">暂无收藏</p>
          <p className="text-xs text-gray-300 mt-1">浏览网页时点击「收藏」按钮添加</p>
        </div>
      )}

      {/* Status messages */}
      {state === 'success' && (
        <div className="flex items-center gap-2 text-green-600 text-sm bg-green-50 rounded-lg p-3 shadow-soft">
          <CheckCircle className="w-4 h-4" />导入成功！
        </div>
      )}
      {state === 'error' && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3 shadow-soft">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      {pdfState === 'done' && (
        <p className="text-xs text-emerald-600 text-center">PDF 已保存，可上传到 NotebookLM 作为来源</p>
      )}
    </div>
  );
}
