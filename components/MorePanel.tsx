import { useState, useEffect, useRef } from 'react';
import {
  Rss,
  Loader2,
  CheckCircle,
  AlertCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ExternalLink,
  Youtube,
  Github,
  Heart,
  HelpCircle,
  Star,
  PlayCircle,
  Edit3,
  DatabaseBackup,
  Download,
  Upload,
} from 'lucide-react';
import type { ImportProgress, ImportItem, RssFeedItem } from '@/lib/types';
import { t } from '@/lib/i18n';
import { resetOnboarding } from '@/components/OnboardingTour';
import { getSettings, updateSettings } from '@/lib/settings';
import {
  collectBackup,
  serializeBackup,
  backupFilename,
  parseBackup,
  applyBackup,
  type ImportMode,
  type BackupPayload,
} from '@/services/backup';

interface Props {
  onProgress: (progress: ImportProgress | null) => void;
}

type ImportState = 'idle' | 'loading' | 'importing' | 'success' | 'error';

export function MorePanel({ onProgress }: Props) {
  const [rssUrl, setRssUrl] = useState('');
  const [rssArticles, setRssArticles] = useState<RssFeedItem[]>([]);
  const [selectedArticles, setSelectedArticles] = useState<Set<string>>(new Set());
  const [state, setState] = useState<ImportState>('idle');
  const [error, setError] = useState('');
  const [importResults, setImportResults] = useState<ImportItem[] | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [showRss, setShowRss] = useState(false);
  const [autoRename, setAutoRename] = useState(true);

  // ── Data backup / restore (issue #47) ──
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [backupMsg, setBackupMsg] = useState('');
  const [backupErr, setBackupErr] = useState('');
  // Holds a validated overwrite payload awaiting explicit confirmation — an
  // overwrite wipes existing data, so it must never apply on the first click.
  const [pendingOverwrite, setPendingOverwrite] = useState<BackupPayload | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getSettings().then((s) => setAutoRename(s.autoRenamePastedSources));
  }, []);

  const toggleAutoRename = async () => {
    const next = !autoRename;
    setAutoRename(next);
    await updateSettings({ autoRenamePastedSources: next });
  };

  const handleExportData = async () => {
    setBackupErr('');
    setBackupMsg('');
    setPendingOverwrite(null);
    try {
      const payload = await collectBackup();
      const blob = new Blob([serializeBackup(payload)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = backupFilename(payload.exportedAt);
      a.click();
      // Defer revoke so the browser can finish reading the blob for the download;
      // revoking synchronously after click() can cancel it in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setBackupMsg(t('more.exportSuccess'));
    } catch {
      setBackupErr(t('more.exportFailed'));
    }
  };

  const runImport = async (payload: BackupPayload, mode: ImportMode) => {
    setPendingOverwrite(null);
    try {
      const count = await applyBackup(payload, mode);
      setBackupMsg(t('more.importSuccessMsg', { count }));
    } catch {
      setBackupErr(t('more.importFailed'));
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setBackupErr('');
    setBackupMsg('');
    setPendingOverwrite(null);
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;
    let parsed;
    try {
      parsed = parseBackup(await file.text());
    } catch {
      setBackupErr(t('more.importFailed'));
      return;
    }
    if (!parsed.ok) {
      setBackupErr(t('more.importFailed'));
      return;
    }
    // Overwrite destroys existing data → require an explicit second confirm.
    if (importMode === 'overwrite') {
      setPendingOverwrite(parsed.payload);
      return;
    }
    await runImport(parsed.payload, 'merge');
  };

  const resetState = () => {
    setState('idle');
    setError('');
    setImportResults(null);
  };

  // ── RSS ──
  const handleRssLoad = () => {
    if (!rssUrl) { setError(t('more.enterRssLink')); setState('error'); return; }
    setState('loading');
    setError('');
    setRssArticles([]);

    chrome.runtime.sendMessage({ type: 'PARSE_RSS', rssUrl }, (response) => {
      if (response?.success && Array.isArray(response.data)) {
        const items = response.data as RssFeedItem[];
        setRssArticles(items);
        setSelectedArticles(new Set(items.map((a) => a.url)));
        setState('idle');
      } else {
        setState('error');
        setError(response?.error || t('more.rssFailed'));
      }
    });
  };

  const handleBatchImport = (urls: string[]) => {
    setState('importing');
    setError('');
    setImportResults(null);

    const items: ImportItem[] = urls.map((u) => ({ url: u, status: 'pending' as const }));
    onProgress({ total: urls.length, completed: 0, items });

    chrome.runtime.sendMessage(
      { type: 'RESCUE_SOURCES', urls },
      (response) => {
        onProgress(null);
        if (response?.success && Array.isArray(response.data)) {
          setImportResults(response.data);
          setState('success');
        } else {
          setState('error');
          setError(response?.error || t('importFailed'));
        }
      }
    );
  };

  const handleRssImport = () => {
    const urls = rssArticles.filter((a) => selectedArticles.has(a.url)).map((a) => a.url);
    if (urls.length === 0) { setError(t('selectAtLeastOneArticle')); setState('error'); return; }
    handleBatchImport(urls);
  };

  const handleRetryFailed = () => {
    if (!importResults) return;
    const failedUrls = importResults.filter((i) => i.status === 'error').map((i) => i.url);
    if (failedUrls.length > 0) handleBatchImport(failedUrls);
  };

  const successCount = importResults?.filter((i) => i.status === 'success').length || 0;
  const failedCount = importResults?.filter((i) => i.status === 'error').length || 0;

  return (
    <div className="space-y-4">
      {/* RSS Import — collapsible section */}
      <div className="border border-border rounded-lg overflow-hidden shadow-soft">
        <button
          onClick={() => { setShowRss(!showRss); resetState(); }}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-surface-sunken hover:bg-gray-100/80 transition-colors"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Rss className="w-4 h-4 text-orange-500" />
            {t('more.rssImport')}
          </div>
          {showRss ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {showRss && (
          <div className="p-3 space-y-3 border-t border-gray-200">
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Rss className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="url"
                  value={rssUrl}
                  onChange={(e) => setRssUrl(e.target.value)}
                  placeholder="https://example.com/feed.xml"
                  className="w-full pl-10 pr-3 py-2 border border-gray-200/60 rounded-lg text-sm placeholder:text-gray-400/70 focus:outline-none focus:ring-2 focus:ring-notebooklm-blue/40 focus:border-transparent"
                />
              </div>
              <button
                onClick={handleRssLoad}
                disabled={!rssUrl || state === 'loading'}
                className="px-4 py-2 bg-orange-500 text-white text-sm rounded-lg hover:bg-orange-500/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
              >
                {state === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                {t('load')}
              </button>
            </div>

            {rssArticles.length > 0 && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-600">{t('more.selectedArticles', { selected: selectedArticles.size, total: rssArticles.length })}</span>
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => setSelectedArticles(new Set(rssArticles.map((a) => a.url)))} className="text-notebooklm-blue hover:underline">{t('selectAll')}</button>
                      <button onClick={() => setSelectedArticles(new Set())} className="text-gray-400 hover:underline">{t('deselectAll')}</button>
                    </div>
                  </div>
                  <div className="max-h-48 overflow-y-auto border border-border-strong rounded-lg shadow-soft">
                    {rssArticles.map((article) => (
                      <label key={article.url} className="flex items-start gap-3 p-2 hover:bg-gray-50 cursor-pointer border-b border-gray-100 last:border-b-0">
                        <input
                          type="checkbox"
                          checked={selectedArticles.has(article.url)}
                          onChange={() => {
                            setSelectedArticles((prev) => {
                              const next = new Set(prev);
                              if (next.has(article.url)) next.delete(article.url);
                              else next.add(article.url);
                              return next;
                            });
                          }}
                          className="mt-1 rounded border-gray-300 text-notebooklm-blue focus:ring-notebooklm-blue"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 line-clamp-2">{article.title}</p>
                          {article.pubDate && <p className="text-xs text-gray-400 mt-0.5">{new Date(article.pubDate).toLocaleDateString(undefined)}</p>}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleRssImport}
                  disabled={selectedArticles.size === 0 || state === 'importing'}
                  className="w-full py-2.5 bg-notebooklm-blue text-white text-sm rounded-lg hover:bg-notebooklm-blue/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-btn hover:shadow-btn-hover transition-all duration-150 btn-press"
                >
                  {state === 'importing' ? <><Loader2 className="w-4 h-4 animate-spin" />{t('importing')}</> : <><Rss className="w-4 h-4" />{t('more.importSelected')} (<span className="font-mono tabular-nums">{selectedArticles.size}</span>)</>}
                </button>
              </>
            )}

            {rssArticles.length === 0 && state === 'idle' && (
              <div className="bg-surface-sunken rounded-lg p-3">
                <p className="text-xs text-gray-400">{t('more.rssFormats')}</p>
              </div>
            )}

            {state === 'error' && !importResults && (
              <div className="flex items-center gap-2 text-red-500 text-sm bg-red-50 rounded-lg p-3 shadow-soft border border-red-100/60">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Import Results */}
      {importResults && importResults.length > 0 && (
        <div className="space-y-2">
          <div className={`flex items-center justify-between text-sm rounded-lg p-3 shadow-soft ${failedCount > 0 ? 'bg-yellow-50 border border-yellow-100/60' : 'bg-green-50 border border-green-100/60'}`}>
            <div className="flex items-center gap-2">
              {failedCount > 0 ? <AlertCircle className="w-4 h-4 text-yellow-600" /> : <CheckCircle className="w-4 h-4 text-green-600" />}
              <span className={failedCount > 0 ? 'text-yellow-700' : 'text-green-600'}>
                {failedCount > 0 ? t('successFailCount', { success: successCount, failed: failedCount }) : t('successCount', { success: successCount })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {failedCount > 0 && (
                <button onClick={handleRetryFailed} disabled={state === 'importing'} className="text-xs text-yellow-700 hover:text-yellow-800 flex items-center gap-1">
                  <RotateCcw className="w-3 h-3" />{t('retryFailed')}
                </button>
              )}
              <button onClick={() => setShowDetails(!showDetails)} className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1">
                {showDetails ? <><ChevronUp className="w-3 h-3" />{t('collapse')}</> : <><ChevronDown className="w-3 h-3" />{t('details')}</>}
              </button>
            </div>
          </div>
          {showDetails && (
            <div className="max-h-40 overflow-y-auto border border-border rounded-lg divide-y divide-gray-100">
              {importResults.map((item, index) => (
                <div key={index} className="flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-50">
                  {item.status === 'success'
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />}
                  <span className="flex-1 truncate text-gray-600" title={item.url}>{item.url}</span>
                  {item.status === 'error' && (
                    <button onClick={() => handleBatchImport([item.url])} disabled={state === 'importing'} className="text-gray-400 hover:text-notebooklm-blue flex-shrink-0" title={t('retry')}>
                      <RotateCcw className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Replay Tour */}
      <button
        onClick={async () => {
          await resetOnboarding();
          window.location.reload();
        }}
        className="w-full flex items-center gap-3 p-2.5 bg-blue-50/60 border border-blue-100/40 rounded-xl hover:bg-blue-100/80 transition-colors group"
      >
        <div className="w-8 h-8 bg-notebooklm-blue rounded-lg flex items-center justify-center flex-shrink-0">
          <HelpCircle className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0 text-left">
          <p className="text-sm font-medium text-gray-800 group-hover:text-notebooklm-blue">{t('onboarding.replayTour')}</p>
          <p className="text-xs text-gray-500">{t('onboarding.replayTourDesc')}</p>
        </div>
      </button>

      {/* Tutorial Video */}
      <a
        href="https://youtu.be/9gPTuJZRHJk"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 p-2.5 bg-red-50/60 border border-red-100/40 rounded-xl hover:bg-red-100/80 transition-colors group"
      >
        <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <PlayCircle className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 group-hover:text-red-700">{t('more.tutorial')}</p>
          <p className="text-xs text-gray-500">{t('more.tutorialDesc')}</p>
        </div>
        <ExternalLink className="w-3.5 h-3.5 text-gray-400 group-hover:text-red-500 flex-shrink-0" />
      </a>

      {/* Settings: Auto-rename pasted sources */}
      <div className="flex items-center gap-3 p-2.5 bg-slate-50/60 border border-slate-100/60 rounded-xl">
        <div className="w-8 h-8 bg-slate-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Edit3 className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{t('more.autoRenameTitle')}</p>
          <p className="text-xs text-gray-500">{t('more.autoRenameDesc')}</p>
        </div>
        <button
          onClick={toggleAutoRename}
          role="switch"
          aria-checked={autoRename}
          className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-notebooklm-blue/40 ${
            autoRename ? 'bg-notebooklm-blue' : 'bg-gray-300'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
              autoRename ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
      </div>

      {/* Data backup & migration (issue #47) */}
      <div className="p-2.5 bg-emerald-50/50 border border-emerald-100/50 rounded-xl space-y-2.5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <DatabaseBackup className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-800">{t('more.backupTitle')}</p>
            <p className="text-xs text-gray-500">{t('more.backupDesc')}</p>
          </div>
        </div>

        {/* Import mode selector */}
        <div className="flex gap-1.5" role="radiogroup" aria-label={t('more.importMergeTitle')}>
          {(['merge', 'overwrite'] as const).map((mode) => (
            <button
              key={mode}
              role="radio"
              aria-checked={importMode === mode}
              onClick={() => setImportMode(mode)}
              title={mode === 'merge' ? t('more.importMergeDesc') : t('more.importOverwriteDesc')}
              className={`flex-1 px-2 py-1.5 text-xs rounded-lg border transition-colors ${
                importMode === mode
                  ? mode === 'overwrite'
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white/70 text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {mode === 'merge' ? t('more.importMerge') : t('more.importOverwrite')}
            </button>
          ))}
        </div>
        {importMode === 'overwrite' && !pendingOverwrite && (
          <p className="text-[11px] text-red-500 flex items-start gap-1">
            <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
            {t('more.importConfirmOverwrite')}
          </p>
        )}

        {/* Overwrite confirm gate — a valid file was chosen; require explicit OK. */}
        {pendingOverwrite && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-2 space-y-2">
            <p className="text-[11px] text-red-600 flex items-start gap-1">
              <AlertCircle className="w-3 h-3 mt-0.5 flex-shrink-0" />
              {t('more.importConfirmOverwrite')}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => runImport(pendingOverwrite, 'overwrite')}
                className="btn-press flex-1 px-2 py-1.5 bg-red-500 text-white text-xs rounded-lg hover:bg-red-600 transition-colors"
              >
                {t('more.importOverwriteConfirmBtn')}
              </button>
              <button
                onClick={() => setPendingOverwrite(null)}
                className="btn-press flex-1 px-2 py-1.5 bg-white text-gray-600 text-xs rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        )}

        {/* Export / Import buttons */}
        <div className="flex gap-2">
          <button
            onClick={handleExportData}
            className="btn-press flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-emerald-700 text-sm rounded-lg border border-emerald-200 hover:bg-emerald-50 transition-colors shadow-btn"
          >
            <Download className="w-4 h-4" />
            {t('more.exportData')}
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="btn-press flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-white text-gray-700 text-sm rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors shadow-btn"
          >
            <Upload className="w-4 h-4" />
            {t('more.importData')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        {backupMsg && (
          <div className="flex items-center gap-2 text-emerald-700 text-xs bg-emerald-50 rounded-lg p-2 border border-emerald-100/60">
            <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {backupMsg}
          </div>
        )}
        {backupErr && (
          <div className="flex items-center gap-2 text-red-500 text-xs bg-red-50 rounded-lg p-2 border border-red-100/60">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {backupErr}
          </div>
        )}
      </div>

      {/* Rate on Chrome Web Store */}
      <div className="flex items-center gap-3 p-2.5 bg-amber-50/60 border border-amber-100/40 rounded-xl">
        <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center flex-shrink-0">
          <Star className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800">{t('more.rateTitle')}</p>
          <p className="text-xs text-gray-500">{t('more.rateDesc')}</p>
        </div>
        <a
          href="https://chromewebstore.google.com/detail/notebooklm-jetpack/jgjgpfgcbdblgejodmooigkhlciejjhg/reviews"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-press px-3 py-1.5 bg-amber-500 text-white text-xs font-medium rounded-lg hover:bg-amber-600 transition-colors shadow-btn hover:shadow-btn-hover flex-shrink-0"
        >
          {t('more.rateBtn')}
        </a>
      </div>

      {/* Footer — version, credit & links */}
      <div className="flex flex-col items-center gap-1.5 pt-1">
        <p className="text-[10px] text-gray-300 font-mono tabular-nums">
          v{__VERSION__}+{__GIT_HASH__}
        </p>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <span className="flex items-center gap-1">
            Made with <Heart className="w-3 h-3 text-red-400" /> by {t('more.madeBy')}
          </span>
          <span className="text-gray-200">|</span>
          <a
            href="https://www.youtube.com/@greentrainpodcast"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50"
            title={t('more.ytChannel')}
          >
            <Youtube className="w-3.5 h-3.5" />
          </a>
          <a
            href="https://github.com/crazynomad/notebooklm-jetpack"
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 text-gray-400 hover:text-gray-800 transition-colors rounded-md hover:bg-gray-100"
            title="GitHub"
          >
            <Github className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
