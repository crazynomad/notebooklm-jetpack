import { useState } from 'react';
import { BookOpen, Loader2, CheckCircle, AlertCircle, Search, ChevronRight, FileDown, Rocket } from 'lucide-react';
import type { ImportProgress, DocSiteInfo, DocPageItem, DocFramework } from '@/lib/types';
import type { PdfProgress } from '@/services/pdf-generator';
import { t } from '@/lib/i18n';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type State = 'idle' | 'analyzing' | 'analyzed' | 'importing' | 'success' | 'error';

export function DocsImport({ onProgress }: Props) {
  const [siteInfo, setSiteInfo] = useState<DocSiteInfo | null>(null);
  const [selectedPages, setSelectedPages] = useState<Set<string>>(new Set());
  const [state, setState] = useState<State>('idle');
  const [error, setError] = useState('');
  const [results, setResults] = useState<{ success: number; failed: number } | null>(null);
  const [pdfState, setPdfState] = useState<'idle' | 'fetching' | 'generating' | 'done'>('idle');
  const [pdfProgress, setPdfProgress] = useState<PdfProgress | null>(null);
  const [isOnNotebookLM, setIsOnNotebookLM] = useState(false);
  const [manualUrl, setManualUrl] = useState('');

  const FRAMEWORK_LABELS: Record<DocFramework, string> = {
    docusaurus: 'Docusaurus',
    mkdocs: 'MkDocs / Material',
    gitbook: 'GitBook',
    vitepress: 'VitePress',
    readthedocs: 'ReadTheDocs / Sphinx',
    sphinx: 'Sphinx',
    mintlify: 'Mintlify',
    devsite: 'Google DevSite',
    anthropic: 'Anthropic Docs',
    sitemap: 'Sitemap',
    yuque: t('docs.yuque'),
    wechat: t('docs.wechatDocs'),
    huawei: t('docs.harmonyDocs'),
    unknown: t('docs.unknownFramework'),
  };

  // Detect if current tab is NotebookLM
  useState(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const url = tabs[0]?.url || '';
      if (/notebooklm\.google\.com/.test(url)) {
        setIsOnNotebookLM(true);
      }
    });
  });

  const analyzeUrl = async (targetUrl: string) => {
    setState('analyzing');
    setError('');
    setSiteInfo(null);

    // Open the URL in a new tab, analyze it, then close
    const newTab = await chrome.tabs.create({ url: targetUrl, active: false });
    if (!newTab.id) {
      setState('error');
      setError(t('docs.cannotCreateTab'));
      return;
    }

    // Wait for tab to load
    await new Promise<void>((resolve) => {
      const listener = (tabId: number, info: chrome.tabs.TabChangeInfo) => {
        if (tabId === newTab.id && info.status === 'complete') {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
      // Timeout after 15s
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 15000);
    });

    chrome.runtime.sendMessage({ type: 'ANALYZE_DOC_SITE', tabId: newTab.id }, (response) => {
      // Close the helper tab
      if (newTab.id) chrome.tabs.remove(newTab.id);

      if (response?.success && response.data) {
        const info = response.data as DocSiteInfo;
        if (info.pages.length === 0) {
          setState('error');
          setError(t('docs.noDocsFound'));
          return;
        }
        setSiteInfo(info);
        setSelectedPages(new Set(info.pages.map((p) => p.url)));
        setState('analyzed');
      } else {
        setState('error');
        setError(response?.error || t('docs.analyzeFailed'));
      }
    });
  };

  const handleAnalyze = async () => {
    if (isOnNotebookLM) {
      // Manual URL mode
      if (!manualUrl || !manualUrl.startsWith('http')) {
        setState('error');
        setError(t('docs.enterDocUrl'));
        return;
      }
      await analyzeUrl(manualUrl);
      return;
    }

    setState('analyzing');
    setError('');
    setSiteInfo(null);

    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.id || !tab.url) {
      setState('error');
      setError(t('docs.cannotGetTab'));
      return;
    }

    // Check if it's a valid HTTP(S) page
    if (!tab.url.startsWith('http')) {
      setState('error');
      setError(t('docs.useOnDocSite'));
      return;
    }

    chrome.runtime.sendMessage({ type: 'ANALYZE_DOC_SITE', tabId: tab.id }, (response) => {
      if (response?.success && response.data) {
        const info = response.data as DocSiteInfo;

        if (info.pages.length === 0) {
          setState('error');
          setError(t('docs.noDocsSidebar'));
          return;
        }

        setSiteInfo(info);
        setSelectedPages(new Set(info.pages.map((p) => p.url)));
        setState('analyzed');
      } else {
        setState('error');
        setError(response?.error || t('docs.analyzeCurrentFailed'));
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
      setError(t('selectAtLeastOnePage'));
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
        setError(response?.error || t('importFailed'));
      }
    });
  };

  const handleExportPdf = async () => {
    if (!siteInfo) return;

    const pages = siteInfo.pages.filter((p) => selectedPages.has(p.url));
    if (pages.length === 0) {
      setError(t('selectAtLeastOnePage'));
      setState('error');
      return;
    }

    setPdfState('fetching');
    setPdfProgress(null);
    setError('');

    try {
      const filteredSiteInfo = { ...siteInfo, pages };
      // Connect to background via port for progress updates
      const port = chrome.runtime.connect({ name: 'pdf-export' });
      port.postMessage({ type: 'GENERATE_PDF', siteInfo: filteredSiteInfo });

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
          setError(msg.error || t('pdfFailed'));
          setPdfState('idle');
          port.disconnect();
        }
      });

      port.onDisconnect.addListener(() => {
        // Background disconnected (e.g. service worker restart) — if not done, show message
        if (pdfState !== 'done') {
          setPdfState('done');
          // PDF generation continues in background even if port drops
        }
      });
    } catch (err) {
      setState('error');
      setError(err instanceof Error ? err.message : t('pdfFailed'));
      setPdfState('idle');
    }
  };

  // Group pages by section for better display
  const groupedPages = siteInfo?.pages.reduce(
    (acc, page) => {
      const section = page.section || t('docs.uncategorized');
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
      {/* Analyze: URL input when on NotebookLM, button when on doc site */}
      {isOnNotebookLM ? (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700 tracking-tight">{t('docs.siteUrl')}</label>
          <div className="flex gap-2">
            <input
              type="url"
              value={manualUrl}
              onChange={(e) => setManualUrl(e.target.value)}
              placeholder="https://docs.openclaw.ai/"
              className="flex-1 px-3.5 py-2.5 border border-gray-200/60 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-notebooklm-blue/40 focus:border-transparent"
              onKeyDown={(e) => { if (e.key === 'Enter') handleAnalyze(); }}
            />
            <button
              onClick={handleAnalyze}
              disabled={state === 'analyzing' || !manualUrl}
              className="px-4 py-2 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-notebooklm-blue/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
            >
              {state === 'analyzing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Search className="w-4 h-4" />
              )}
              {t('analyze')}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={handleAnalyze}
          disabled={state === 'analyzing'}
          className="w-full py-3 px-4 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-notebooklm-blue/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
        >
          {state === 'analyzing' ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('docs.analyzing')}
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              {t('docs.analyzeCurrent')}
            </>
          )}
        </button>
      )}

      {/* Site info */}
      {siteInfo && (
        <div className="bg-notebooklm-light/50 border border-notebooklm-blue/10 rounded-lg p-3 shadow-soft">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-4 h-4 text-notebooklm-blue" />
            <span className="text-sm font-medium text-blue-900 truncate tracking-tight">{siteInfo.title}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-notebooklm-blue">
            <span className="bg-notebooklm-blue/10 text-notebooklm-blue px-2 py-0.5 rounded">
              {FRAMEWORK_LABELS[siteInfo.framework]}
            </span>
            <span className="font-mono tabular-nums">{siteInfo.pages.length}</span>
            <span>{t('docs.pages')}</span>
          </div>
        </div>
      )}

      {/* Page list */}
      {siteInfo && siteInfo.pages.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">
              {t('docs.selectedPages', { selected: selectedPages.size, total: siteInfo.pages.length })}
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={handleSelectAll} className="text-notebooklm-blue hover:underline transition-colors duration-150">
                {t('selectAll')}
              </button>
              <button onClick={handleDeselectAll} className="text-gray-400 hover:underline transition-colors duration-150">
                {t('deselectAll')}
              </button>
            </div>
          </div>

          <div className="max-h-40 overflow-y-auto border border-border-strong rounded-lg shadow-soft">
            {groupedPages &&
              Object.entries(groupedPages).map(([section, pages]) => (
                <div key={section}>
                  {section !== t('docs.uncategorized') && (
                    <div className="sticky top-0 px-3 py-1.5 bg-surface-sunken border-b border-gray-100 text-xs font-medium text-gray-500 tracking-tight flex items-center gap-1">
                      <ChevronRight className="w-3 h-3" />
                      {section}
                    </div>
                  )}
                  {pages.map((page) => (
                    <label
                      key={page.url}
                      className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0 transition-colors duration-150"
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
            className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-notebooklm-blue/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
          >
            {state === 'importing' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {t('importing')}
              </>
            ) : (
              <>
                <BookOpen className="w-4 h-4" />
                {t('docs.urlImport')} (<span className="font-mono tabular-nums">{selectedPages.size}</span>)
              </>
            )}
          </button>

          {/* PDF Export */}
          <button
            onClick={handleExportPdf}
            disabled={selectedPages.size === 0 || state === 'importing' || pdfState === 'fetching' || pdfState === 'generating'}
            className="w-full py-2.5 bg-emerald-500 text-white text-sm rounded-lg hover:bg-emerald-500/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
          >
            {pdfState === 'fetching' || pdfState === 'generating' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {pdfState === 'fetching'
                  ? <>{t('pdfFetching', { current: pdfProgress?.current || 0, total: pdfProgress?.total || selectedPages.size })}</>
                  : <>{t('pdfGenerating', { current: pdfProgress?.current || 0, total: pdfProgress?.total || 1 })}</>}
              </>
            ) : pdfState === 'done' ? (
              <>
                <CheckCircle className="w-4 h-4" />
                {t('pdfDownloaded')}
              </>
            ) : (
              <>
                <FileDown className="w-4 h-4" />
                {t('docs.exportPdf', { count: selectedPages.size })}
              </>
            )}
          </button>

          {pdfState === 'done' && (
            <p className="text-xs text-emerald-600 text-center">
              {t('docs.pdfSaved')}
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {results && (
        <div
          className={`flex items-center gap-2 text-sm rounded-lg p-3 shadow-soft ${
            results.failed > 0
              ? 'bg-yellow-50/80 border border-yellow-100/60 text-yellow-700'
              : 'bg-green-50/80 border border-green-100/60 text-green-600'
          }`}
        >
          {results.failed > 0 ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <CheckCircle className="w-4 h-4" />
          )}
          {results.failed > 0 ? t('successFailCount', { success: results.success, failed: results.failed }) : t('successCount', { success: results.success })}
        </div>
      )}

      {state === 'error' && !results && (
        <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50/80 border border-red-100/60 rounded-lg p-3 shadow-soft">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tips */}
      {!siteInfo && state === 'idle' && (
        <div className="text-xs text-gray-400 space-y-3 bg-surface-sunken rounded-xl p-4">
          <div className="flex items-center gap-2">
            <Rocket className="w-4 h-4 text-gray-500" />
            <p className="font-medium text-gray-600 tracking-tight">{t('docs.instructions')}</p>
          </div>
          {isOnNotebookLM ? (
            <ol className="list-decimal list-inside space-y-1.5 text-gray-500">
              <li>{t('docs.tipNlm1')}</li>
              <li>{t('docs.tipNlm2')}</li>
              <li>{t('docs.tipNlm3')}</li>
            </ol>
          ) : (
            <ol className="list-decimal list-inside space-y-1.5 text-gray-500">
              <li>{t('docs.tipSite1')}</li>
              <li>{t('docs.tipSite2')}</li>
              <li>{t('docs.tipSite3')}</li>
              <li>{t('docs.tipSite4')}</li>
            </ol>
          )}
          <div className="pt-2 border-t border-gray-200/60">
            <p className="text-gray-600 font-medium mb-2">{t('docs.supportedFrameworks')}</p>
            <ul className="list-disc list-inside space-y-1 text-gray-500">
              <li>{t('docs.frameworks1')}</li>
              <li>{t('docs.frameworks2')}</li>
              <li>{t('docs.frameworks3')}</li>
              <li>{t('docs.frameworks4')}</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
