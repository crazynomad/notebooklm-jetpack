import { useState } from 'react';
import { BookOpen, Loader2, CheckCircle, AlertCircle, Search, ChevronRight, FileDown } from 'lucide-react';
import type { ImportProgress, DocSiteInfo, DocPageItem, DocFramework } from '@/lib/types';
import { generateDocsPdf, downloadPdfVolume, type PdfProgress } from '@/services/pdf-generator';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type State = 'idle' | 'analyzing' | 'analyzed' | 'importing' | 'success' | 'error';

const FRAMEWORK_LABELS: Record<DocFramework, string> = {
  docusaurus: 'Docusaurus',
  mkdocs: 'MkDocs / Material',
  gitbook: 'GitBook',
  vitepress: 'VitePress',
  readthedocs: 'ReadTheDocs / Sphinx',
  sphinx: 'Sphinx',
  mintlify: 'Mintlify',
  anthropic: 'Anthropic Docs',
  sitemap: 'Sitemap',
  yuque: '语雀',
  wechat: '微信文档',
  huawei: '鸿蒙文档',
  unknown: '未识别框架',
};

export function DocsImport({ onProgress }: Props) {
  const [siteInfo, setSiteInfo] = useState<DocSiteInfo | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [pdfState, setPdfState] = useState<'idle' | 'fetching' | 'generating' | 'done'>('idle');
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);

  const handleAnalyze = async () => {
    setState('analyzing');
    setError('');
    setSiteInfo(null);

    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id || !tab.url) {
      setState('error');
      setError('无法获取当前标签页信息');
      return;
    }

    // Check if it's a valid HTTP(S) page
    if (!tab.url.startsWith('http')) {
      setState('error');
      setError('请在文档站点页面上使用此功能');
      return;
    }

    chrome.runtime.sendMessage({ type: 'ANALYZE_DOC_SITE', tabId: tab.id }, (response) => {
      if (response?.success && response.data) {
        const info = response.data as DocSiteInfo;

        if (info.pages.length === 0) {
          setState('error');
          setError('未能从此页面提取到文档链接，请确保在文档站点的侧边栏可见时使用');
          return;
        }

        setSiteInfo(info);
        setSelectedPages(new Set(info.pages.map((p) => p.url)));
        setState('analyzed');
      } else {
        setState('error');
        setError(response?.error || '分析失败，请确保当前页面是文档站点');
      }
    });
  };

  const handleTogglePage = (url: string) => {
    setSelectedPages((prev) => {
      const next = new Set(prev);
      if (next.has(url)) {
        next.delete(url);
      } else {
        next.add(url);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (siteInfo) {
      setSelectedPages(new Set(siteInfo.pages.map((p) => p.url)));
    }
  };

  const handleDeselectAll = () => {
    setSelectedPages(new Set());
  };

  const handleImport = async () => {
    if (!siteInfo) return;

    const urls = siteInfo.pages.filter((p) => selectedPages.has(p.url)).map((p) => p.url);

    if (urls.length === 0) {
      setError('请至少选择一个页面');
      setState('error');
      return;
    }

    setState('importing');
    setError('');
    setResults(null);

    const progress: ImportProgress = {
      total: urls.length,
      completed: 0,
      items: urls.map((url) => ({ url, status: 'pending' })),
    };
    onProgress(progress);

    chrome.runtime.sendMessage({ type: 'IMPORT_BATCH', urls }, (response) => {
      onProgress(null);

      if (response?.success && response.data) {
        const result = response.data as ImportProgress;
        const success = result.items.filter((i) => i.status === 'success').length;
        const failed = result.items.filter((i) => i.status === 'error').length;

        setResults({ success, failed });
        setState(failed > 0 ? 'error' : 'success');
      } else {
        setState('error');
        setError(response?.error || '导入失败');
      }
    });
  };

  const handleExportPdf = async () => {
    if (!siteInfo) return;

    const pages = siteInfo.pages.filter((p) => selectedPages.has(p.url));
    if (pages.length === 0) {
      setError('请至少选择一个页面');
      setState('error');
      return;
    }

    setPdfState('fetching');
    setPdfProgress(null);
    setError('');

    try {
      const filteredSiteInfo = { ...siteInfo, pages };
      const volumes = await generateDocsPdf(filteredSiteInfo, {
        concurrency: 5,
        maxPages: 500,
        onProgress: (progress) => {
          setPdfProgress(progress);
          setPdfState(progress.phase === 'done' ? 'done' : progress.phase);
        },
      });

      // Download all volumes
      for (const volume of volumes) {
        downloadPdfVolume(volume);
      }

      setPdfState('done');
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : 'PDF 生成失败');
      setPdfState('idle');
    }
  };

  // Group pages by section for better display
  const groupedPages = siteInfo?.pages.reduce(
    (acc, page) => {
      const section = page.section || '未分类';
      if (!acc[section]) {
        acc[section] = [];
      }
      acc[section].push(page);
      return acc;
    },
    {} as Record<string, DocPageItem[]>
  );

  return (
    <div className="space-y-4">
      {/* Analyze button */}
      <button
        onClick={handleAnalyze}
        disabled={state === 'analyzing'}
        className="w-full py-3 px-4 bg-indigo-500 text-white text-sm rounded-lg hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {state === 'analyzing' ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            正在分析...
          </>
        ) : (
          <>
            <Search className="w-4 h-4" />
            分析当前站点
          </>
        )}
      </button>

      {/* Site info */}
      {siteInfo && (
        <div className="bg-indigo-50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-indigo-600" />
            <span className="text-sm font-medium text-indigo-900 truncate">{siteInfo.title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-indigo-600">
            <span className="bg-indigo-100 px-2 py-0.5 rounded">
              {FRAMEWORK_LABELS[siteInfo.framework]}
            </span>
            <span>{siteInfo.pages.length} 个页面</span>
          </div>
        </div>
      )}

      {/* Page list */}
      {siteInfo && siteInfo.pages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              已选择 {selectedPages.size}/{siteInfo.pages.length} 个页面
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={handleSelectAll} className="text-notebooklm-blue hover:underline">
                全选
              </button>
              <button onClick={handleDeselectAll} className="text-gray-400 hover:underline">
                取消全选
              </button>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto border border-gray-200 rounded-lg">
            {groupedPages &&
              Object.entries(groupedPages).map(([section, pages]) => (
                <div key={section}>
                  {section !== '未分类' && (
                    <div className="sticky top-0 px-3 py-1.5 bg-gray-50 border-b border-gray-100 text-xs font-medium text-gray-500 flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      {section}
                    </div>
                  )}
                  {pages.map((page) => (
                    <label
                      key={page.url}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0"
                      style={{ paddingLeft: `${(page.level || 0) * 12 + 8}px` }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedPages.has(page.url)}
                        onChange={() => handleTogglePage(page.url)}
                        className="mt-0.5 rounded border-gray-300 text-notebooklm-blue focus:ring-notebooklm-blue"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-700 line-clamp-1">{page.title}</p>
                        <p className="text-xs text-gray-400 truncate">{page.path}</p>
                      </div>
                    </label>
                  ))}
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Action buttons */}
      {siteInfo && siteInfo.pages.length > 0 && (
        <div className="space-y-2">
          {/* URL Import */}
          <button
            onClick={handleImport}
            disabled={selectedPages.size === 0 || state === 'importing' || pdfState === 'fetching' || pdfState === 'generating'}
            className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {state === 'importing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                正在导入...
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                逐个 URL 导入 ({selectedPages.size})
              </>
            )}
          </button>

          {/* PDF Export */}
          <button
            onClick={handleExportPdf}
            disabled={selectedPages.size === 0 || state === 'importing' || pdfState === 'fetching' || pdfState === 'generating'}
            className="w-full py-2.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {pdfState === 'fetching' || pdfState === 'generating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {pdfState === 'fetching'
                  ? `抓取页面 ${pdfProgress?.current || 0}/${pdfProgress?.total || selectedPages.size}...`
                  : `生成 PDF ${pdfProgress?.current || 0}/${pdfProgress?.total || 1}...`}
              </>
            ) : pdfState === 'done' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                PDF 已下载
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                导出为 PDF ({selectedPages.size} 页)
              </>
            )}
          </button>

          {pdfState === 'done' && (
            <p className="text-xs text-emerald-600 text-center">
              PDF 已保存，可在 NotebookLM 中上传为来源
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg p-3 ${
            results.failed > 0 ? 'bg-yellow-50 text-yellow-700' : 'bg-green-50 text-green-600'
          }`}
        >
          {results.failed > 0 ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          成功 {results.success} 个{results.failed > 0 && `，失败 ${results.failed} 个`}
        </div>
      )}

      {state === 'error' && !results && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tips */}
      {!siteInfo && state === 'idle' && (
        <div className="text-xs text-gray-400 space-y-2">
          <p className="font-medium text-gray-500">使用说明：</p>
          <ol className="list-decimal list-inside space-y-1">
            <li>打开文档站点（如 Docusaurus、MkDocs 等）</li>
            <li>确保侧边栏导航可见</li>
            <li>点击「分析当前站点」提取所有页面</li>
            <li>选择要导入的页面，批量导入到 NotebookLM</li>
          </ol>
          <p className="mt-2">支持的框架：</p>
          <ul className="list-disc list-inside space-y-0.5">
            <li>Docusaurus、VitePress、MkDocs</li>
            <li>GitBook、Mintlify、Sphinx</li>
            <li>语雀、微信开发文档</li>
            <li>任何有 sitemap.xml 的站点</li>
          </ul>
        </div>
      )}
    </div>
  );
}
