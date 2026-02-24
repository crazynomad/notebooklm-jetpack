import { useMemo, useSyncExternalStore } from 'react';

export type Locale = 'zh' | 'en';

const zh = {
  // ── Common ──
  'selectAll': '全选',
  'deselectAll': '取消全选',
  'cancel': '取消',
  'importing': '正在导入...',
  'importFailed': '导入失败',
  'importSuccess': '导入成功！',
  'retryFailed': '重试失败',
  'retry': '重试',
  'collapse': '收起',
  'details': '详情',
  'load': '加载',
  'delete': '删除',
  'create': '创建',
  'close': '关闭',
  'import': '导入',
  'analyze': '分析',
  'invalidUrl': '请输入有效的 URL',
  'pdfFailed': 'PDF 生成失败',
  'pdfDownloaded': 'PDF 已下载',
  'pdfFetching': '抓取页面 {current}/{total}...',
  'pdfGenerating': '生成 PDF {current}/{total}...',
  'pdfGeneratingSimple': '生成 PDF...',
  'successCount': '成功 {success} 个',
  'successFailCount': '成功 {success} 个，失败 {failed} 个',
  'successArticles': '成功 {success} 篇',
  'successFailArticles': '成功 {success} 篇，失败 {failed} 篇',
  'selectAtLeastOnePage': '请至少选择一个页面',
  'selectAtLeastOneArticle': '请至少选择一篇文章',

  // ── App ──
  'app.importHistory': '导入历史',
  'app.importingProgress': '正在导入 {completed}/{total}',
  'app.tabBookmarks': '收藏夹',
  'app.tabDocs': '文档站',
  'app.tabPodcast': '播客',
  'app.tabAI': 'AI 对话',
  'app.tabMore': '更多',

  // ── DocsImport ──
  'docs.yuque': '语雀',
  'docs.wechatDocs': '微信文档',
  'docs.harmonyDocs': '鸿蒙文档',
  'docs.unknownFramework': '未识别框架',
  'docs.cannotCreateTab': '无法创建标签页',
  'docs.noDocsFound': '未能从此页面提取到文档链接，请确保该 URL 是文档站点',
  'docs.analyzeFailed': '分析失败，请确保 URL 是文档站点',
  'docs.enterDocUrl': '请输入有效的文档站点 URL',
  'docs.cannotGetTab': '无法获取当前标签页信息',
  'docs.useOnDocSite': '请在文档站点页面上使用此功能',
  'docs.noDocsSidebar': '未能从此页面提取到文档链接，请确保在文档站点的侧边栏可见时使用',
  'docs.analyzeCurrentFailed': '分析失败，请确保当前页面是文档站点',
  'docs.siteUrl': '文档站点 URL',
  'docs.analyzing': '正在分析...',
  'docs.analyzeCurrent': '分析当前站点',
  'docs.pages': '个页面',
  'docs.selectedPages': '已选择 {selected}/{total} 个页面',
  'docs.uncategorized': '未分类',
  'docs.urlImport': '逐个 URL 导入',
  'docs.exportPdf': '导出为 PDF ({count} 页)',
  'docs.pdfSaved': 'PDF 已保存，可在 NotebookLM 中上传为来源',
  'docs.instructions': '使用说明',
  'docs.tipNlm1': '输入文档站点的任意页面 URL',
  'docs.tipNlm2': '点击「分析」自动提取所有页面',
  'docs.tipNlm3': '选择要导入的页面，批量导入到 NotebookLM',
  'docs.tipSite1': '打开文档站点（如 Docusaurus、MkDocs 等）',
  'docs.tipSite2': '确保侧边栏导航可见',
  'docs.tipSite3': '点击「分析当前站点」提取所有页面',
  'docs.tipSite4': '选择要导入的页面，批量导入到 NotebookLM',
  'docs.supportedFrameworks': '支持的框架',
  'docs.frameworks1': 'Docusaurus、VitePress、MkDocs',
  'docs.frameworks2': 'GitBook、Mintlify、Sphinx',
  'docs.frameworks3': '语雀、微信开发文档',
  'docs.frameworks4': '任何有 sitemap.xml 的站点',

  // ── PodcastImport ──
  'podcast.link': '播客链接',
  'podcast.enterLink': '请输入播客链接',
  'podcast.unrecognized': '无法识别链接，支持 Apple Podcasts 和小宇宙',
  'podcast.fetchFailed': '获取失败',
  'podcast.selectAtLeastOne': '请至少选择一集',
  'podcast.downloadFailed': '下载失败',
  'podcast.placeholder': '粘贴 Apple Podcasts 或小宇宙链接...',
  'podcast.latest': '最新',
  'podcast.all': '全部',
  'podcast.episodes': '集',
  'podcast.querying': '查询中...',
  'podcast.query': '查询',
  'podcast.minutes': '分钟',
  'podcast.selectedEpisodes': '已选 {selected}/{total} 集',
  'podcast.downloading': '下载中 {current}/{total}',
  'podcast.downloadDone': '下载完成',
  'podcast.downloadSelected': '下载选中 ({count} 集)',
  'podcast.supportedFormats': '支持的链接格式：',
  'podcast.formatApple': 'Apple Podcasts：podcasts.apple.com/.../id123456',
  'podcast.formatXyz1': '小宇宙单集：xiaoyuzhoufm.com/episode/...',
  'podcast.formatXyz2': '小宇宙节目：xiaoyuzhoufm.com/podcast/...',

  // ── HistoryPanel ──
  'history.title': '导入历史',
  'history.clearHistory': '清除历史',
  'history.confirmClear': '确定要清除所有导入历史吗？',
  'history.justNow': '刚刚',
  'history.minutesAgo': '{count} 分钟前',
  'history.hoursAgo': '{count} 小时前',
  'history.noRecords': '暂无导入记录',
  'history.recordsHint': '导入内容后，记录会出现在这里',

  // ── SingleImport ──
  'single.importFailedHint': '导入失败，请确保 NotebookLM 页面已打开',
  'single.currentTab': '当前标签页',
  'single.enterUrl': '输入 URL',
  'single.importingBtn': '导入中',
  'single.supportedImports': '支持导入：',
  'single.webArticles': '普通网页文章',
  'single.substackWechat': 'Substack / 微信公众号（智能提取正文）',
  'single.pdfLinks': 'PDF 文件链接',

  // ── ClaudeImport ──
  'claude.extractFailed': '提取对话失败',
  'claude.openNotebook': '请先打开 NotebookLM 笔记本页面，然后再导入',
  'claude.cannotGetNlmTab': '无法获取 NotebookLM 标签页',
  'claude.openNotebookNotHome': '请先打开一个 NotebookLM 笔记本（而非首页），然后再导入',
  'claude.openAiPage': '请先打开 AI 对话页面',
  'claude.supported': '支持：Claude · ChatGPT · Gemini',
  'claude.extracting': '正在提取对话...',
  'claude.extractCurrent': '提取当前对话',
  'claude.currentPlatform': '当前平台：',
  'claude.instructions': '使用说明：',
  'claude.step1': '在 {platform} 打开对话页面',
  'claude.step2': '点击「提取当前对话」',
  'claude.step3': '选择要导入的问答对',
  'claude.step4': '点击导入到 NotebookLM',
  'claude.reExtract': '重新提取',
  'claude.qaPairs': '共 {total} 个问答对，已选择 {selected} 个',
  'claude.noQuestion': '(无问题)',
  'claude.noAnswer': '(无回答)',
  'claude.importingBtn': '导入中...',
  'claude.importSelected': '导入选中的 {count} 个问答对',
  'claude.source': '来源',
  'claude.conversation': '对话',
  'claude.guideTitle': '如何使用',
  'claude.guideStep1': '打开 Claude、ChatGPT 或 Gemini 的对话页面',
  'claude.guideStep2': '点击浏览器工具栏中的 Jetpack 图标打开本面板',
  'claude.guideStep3': '点击「提取当前对话」，选择要导入的问答对',
  'claude.guideStep4': '一键导入到 NotebookLM，AI 对话秒变知识来源',
  'claude.guideTip': '💡 导入前请确保已打开一个 NotebookLM 笔记本（非首页）',

  // ── BookmarkPanel ──
  'bookmark.collection': '收藏合集',
  'bookmark.bookmarked': '已收藏',
  'bookmark.addBookmark': '收藏',
  'bookmark.all': '全部',
  'bookmark.newCollection': '新建集合',
  'bookmark.collectionName': '集合名称',
  'bookmark.selectedItems': '已选 {count} 项',
  'bookmark.totalItems': '共 {count} 项',
  'bookmark.moveTo': '移至…',
  'bookmark.moveToCollection': '移至…',
  'bookmark.exportPdf': '聚合导出 PDF ({count} 篇)',
  'bookmark.importToNlm': '导入 NotebookLM ({count} 篇)',
  'bookmark.emptyTitle': '收藏网页，聚合导入',
  'bookmark.emptyDesc': 'NotebookLM 免费用户来源数有限。将多个网页收藏后聚合为一份 PDF 导入，用一个来源额度获取多篇内容。',
  'bookmark.step1': '浏览网页时点击上方「收藏」按钮，将有价值的页面加入收藏夹',
  'bookmark.step2': '选择多个收藏，点击「聚合导出 PDF」合并为一份文档',
  'bookmark.step3': '将 PDF 上传到 NotebookLM，一个来源 = 多篇内容',
  'bookmark.pdfSaved': 'PDF 已保存，可上传到 NotebookLM 作为来源',

  // ── RescueBanner ──
  'rescue.scanning': '扫描失败来源...',
  'rescue.foundFailed': '发现 {count} 个来源导入失败',
  'rescue.rescuing': '正在抢救...',
  'rescue.done': '抢救完成：成功 {success}，失败 {failed}',
  'rescue.rescue': '抢救',

  // ── BatchImport ──
  'batch.getTabsFailed': '获取标签页失败',
  'batch.batchFailed': '批量导入失败',
  'batch.importAllTabs': '导入所有打开的标签页',
  'batch.urlList': 'URL 列表',
  'batch.placeholder': '每行一个 URL，或用逗号分隔',
  'batch.batchImport': '批量导入',

  // ── MorePanel ──
  'more.rssImport': 'RSS 导入',
  'more.rssFailed': 'RSS 解析失败',
  'more.enterRssLink': '请输入 RSS 链接',
  'more.selectedArticles': '已选择 {selected}/{total} 篇',
  'more.importSelected': '导入选中文章',
  'more.rssFormats': '常见格式：/feed, /rss, /atom.xml, medium.com/feed/@user',
  'more.about': '关于',
  'more.ytChannel': '绿皮火车播客',
  'more.ytDesc': 'YouTube 频道 · 教程与分享',
  'more.ghDesc': '开源项目 · 欢迎 Star',
  'more.madeBy': '绿皮火车播客',

  // ── RssImport ──
  'rss.feedUrl': 'RSS 订阅地址',
  'rss.enterFeedUrl': '请输入 RSS 订阅地址',
  'rss.parseFailed': '解析 RSS 失败，请检查 URL 是否正确',
  'rss.selectedArticles': '已选择 {selected}/{total} 篇文章',
  'rss.importSelected': '导入选中文章 ({count})',
  'rss.tipTitle': '常见 RSS 地址格式：',
  'rss.tipBlog': '博客: /feed, /rss, /atom.xml',
  'rss.tipMedium': 'Medium: medium.com/feed/@username',
  'rss.tipSubstack': 'Substack: xxx.substack.com/feed',

  // ── ImportPanel ──
  'panel.single': '单个',
  'panel.batch': '批量',
  'panel.cannotImportNlm': '不能导入 NotebookLM 自身的页面',
  'panel.rssAtomLink': 'RSS / Atom 链接',
  'panel.supportedFormats': '支持导入：网页文章、Substack、微信公众号、PDF 链接（自动修复导入失败的来源）',
} as const;

const en: Record<keyof typeof zh, string> = {
  // ── Common ──
  'selectAll': 'Select All',
  'deselectAll': 'Deselect All',
  'cancel': 'Cancel',
  'importing': 'Importing...',
  'importFailed': 'Import failed',
  'importSuccess': 'Import successful!',
  'retryFailed': 'Retry Failed',
  'retry': 'Retry',
  'collapse': 'Collapse',
  'details': 'Details',
  'load': 'Load',
  'delete': 'Delete',
  'create': 'Create',
  'close': 'Close',
  'import': 'Import',
  'analyze': 'Analyze',
  'invalidUrl': 'Please enter a valid URL',
  'pdfFailed': 'PDF generation failed',
  'pdfDownloaded': 'PDF downloaded',
  'pdfFetching': 'Fetching {current}/{total}...',
  'pdfGenerating': 'Generating PDF {current}/{total}...',
  'pdfGeneratingSimple': 'Generating PDF...',
  'successCount': '{success} succeeded',
  'successFailCount': '{success} succeeded, {failed} failed',
  'successArticles': '{success} articles succeeded',
  'successFailArticles': '{success} succeeded, {failed} failed',
  'selectAtLeastOnePage': 'Please select at least one page',
  'selectAtLeastOneArticle': 'Please select at least one article',

  // ── App ──
  'app.importHistory': 'Import History',
  'app.importingProgress': 'Importing {completed}/{total}',
  'app.tabBookmarks': 'Bookmarks',
  'app.tabDocs': 'Docs',
  'app.tabPodcast': 'Podcast',
  'app.tabAI': 'AI Chat',
  'app.tabMore': 'More',

  // ── DocsImport ──
  'docs.yuque': 'Yuque',
  'docs.wechatDocs': 'WeChat Docs',
  'docs.harmonyDocs': 'HarmonyOS Docs',
  'docs.unknownFramework': 'Unknown',
  'docs.cannotCreateTab': 'Cannot create tab',
  'docs.noDocsFound': 'No documentation links found. Make sure the URL is a documentation site.',
  'docs.analyzeFailed': 'Analysis failed. Make sure the URL is a documentation site.',
  'docs.enterDocUrl': 'Please enter a valid documentation site URL',
  'docs.cannotGetTab': 'Cannot get current tab info',
  'docs.useOnDocSite': 'Please use this feature on a documentation site',
  'docs.noDocsSidebar': 'No documentation links found. Make sure the sidebar is visible.',
  'docs.analyzeCurrentFailed': 'Analysis failed. Make sure the current page is a documentation site.',
  'docs.siteUrl': 'Documentation Site URL',
  'docs.analyzing': 'Analyzing...',
  'docs.analyzeCurrent': 'Analyze Current Site',
  'docs.pages': 'pages',
  'docs.selectedPages': '{selected}/{total} pages selected',
  'docs.uncategorized': 'Uncategorized',
  'docs.urlImport': 'Import URLs',
  'docs.exportPdf': 'Export as PDF ({count} pages)',
  'docs.pdfSaved': 'PDF saved. Upload to NotebookLM as a source.',
  'docs.instructions': 'Instructions',
  'docs.tipNlm1': 'Enter any page URL of the documentation site',
  'docs.tipNlm2': 'Click "Analyze" to extract all pages automatically',
  'docs.tipNlm3': 'Select pages to import into NotebookLM',
  'docs.tipSite1': 'Open a documentation site (e.g., Docusaurus, MkDocs)',
  'docs.tipSite2': 'Make sure the sidebar navigation is visible',
  'docs.tipSite3': 'Click "Analyze Current Site" to extract all pages',
  'docs.tipSite4': 'Select pages to import into NotebookLM',
  'docs.supportedFrameworks': 'Supported Frameworks',
  'docs.frameworks1': 'Docusaurus, VitePress, MkDocs',
  'docs.frameworks2': 'GitBook, Mintlify, Sphinx',
  'docs.frameworks3': 'Yuque, WeChat Developer Docs',
  'docs.frameworks4': 'Any site with sitemap.xml',

  // ── PodcastImport ──
  'podcast.link': 'Podcast Link',
  'podcast.enterLink': 'Please enter a podcast link',
  'podcast.unrecognized': 'Unrecognized link. Supports Apple Podcasts and Xiaoyuzhou.',
  'podcast.fetchFailed': 'Fetch failed',
  'podcast.selectAtLeastOne': 'Please select at least one episode',
  'podcast.downloadFailed': 'Download failed',
  'podcast.placeholder': 'Paste Apple Podcasts or Xiaoyuzhou link...',
  'podcast.latest': 'Latest',
  'podcast.all': 'All',
  'podcast.episodes': 'episodes',
  'podcast.querying': 'Searching...',
  'podcast.query': 'Search',
  'podcast.minutes': 'min',
  'podcast.selectedEpisodes': '{selected}/{total} episodes selected',
  'podcast.downloading': 'Downloading {current}/{total}',
  'podcast.downloadDone': 'Download complete',
  'podcast.downloadSelected': 'Download ({count} episodes)',
  'podcast.supportedFormats': 'Supported link formats:',
  'podcast.formatApple': 'Apple Podcasts: podcasts.apple.com/.../id123456',
  'podcast.formatXyz1': 'Xiaoyuzhou episode: xiaoyuzhoufm.com/episode/...',
  'podcast.formatXyz2': 'Xiaoyuzhou podcast: xiaoyuzhoufm.com/podcast/...',

  // ── HistoryPanel ──
  'history.title': 'Import History',
  'history.clearHistory': 'Clear History',
  'history.confirmClear': 'Are you sure you want to clear all import history?',
  'history.justNow': 'Just now',
  'history.minutesAgo': '{count} min ago',
  'history.hoursAgo': '{count}h ago',
  'history.noRecords': 'No import records',
  'history.recordsHint': 'Records will appear here after importing',

  // ── SingleImport ──
  'single.importFailedHint': 'Import failed. Make sure NotebookLM is open.',
  'single.currentTab': 'Current Tab',
  'single.enterUrl': 'Enter URL',
  'single.importingBtn': 'Importing',
  'single.supportedImports': 'Supported imports:',
  'single.webArticles': 'Web articles',
  'single.substackWechat': 'Substack / WeChat articles (smart extraction)',
  'single.pdfLinks': 'PDF file links',

  // ── ClaudeImport ──
  'claude.extractFailed': 'Failed to extract conversation',
  'claude.openNotebook': 'Please open a NotebookLM notebook first, then import',
  'claude.cannotGetNlmTab': 'Cannot access NotebookLM tab',
  'claude.openNotebookNotHome': 'Please open a NotebookLM notebook (not the home page), then import',
  'claude.openAiPage': 'Please open an AI conversation page first',
  'claude.supported': 'Supports: Claude · ChatGPT · Gemini',
  'claude.extracting': 'Extracting conversation...',
  'claude.extractCurrent': 'Extract Current Conversation',
  'claude.currentPlatform': 'Current platform: ',
  'claude.instructions': 'Instructions:',
  'claude.step1': 'Open a conversation on {platform}',
  'claude.step2': 'Click "Extract Current Conversation"',
  'claude.step3': 'Select Q&A pairs to import',
  'claude.step4': 'Import to NotebookLM',
  'claude.reExtract': 'Re-extract',
  'claude.qaPairs': '{total} Q&A pairs, {selected} selected',
  'claude.noQuestion': '(No question)',
  'claude.noAnswer': '(No answer)',
  'claude.importingBtn': 'Importing...',
  'claude.importSelected': 'Import {count} Q&A pairs',
  'claude.source': 'Source',
  'claude.conversation': 'Conversation',
  'claude.guideTitle': 'How to use',
  'claude.guideStep1': 'Open a conversation on Claude, ChatGPT, or Gemini',
  'claude.guideStep2': 'Click the Jetpack icon in the toolbar to open this panel',
  'claude.guideStep3': 'Click "Extract Current Conversation" and select Q&A pairs',
  'claude.guideStep4': 'Import to NotebookLM — turn AI chats into knowledge sources',
  'claude.guideTip': '💡 Make sure a NotebookLM notebook (not homepage) is open before importing',

  // ── BookmarkPanel ──
  'bookmark.collection': 'Bookmark Collection',
  'bookmark.bookmarked': 'Bookmarked',
  'bookmark.addBookmark': 'Bookmark',
  'bookmark.all': 'All',
  'bookmark.newCollection': 'New Collection',
  'bookmark.collectionName': 'Collection name',
  'bookmark.selectedItems': '{count} selected',
  'bookmark.totalItems': '{count} items',
  'bookmark.moveTo': 'Move to...',
  'bookmark.moveToCollection': 'Move to...',
  'bookmark.exportPdf': 'Export PDF ({count} items)',
  'bookmark.importToNlm': 'Import to NotebookLM ({count})',
  'bookmark.emptyTitle': 'Bookmark pages, import together',
  'bookmark.emptyDesc': 'NotebookLM free users have limited sources. Bookmark multiple pages and export as one PDF to save source slots.',
  'bookmark.step1': 'Click "Bookmark" above to save valuable pages',
  'bookmark.step2': 'Select multiple bookmarks, click "Export PDF" to merge',
  'bookmark.step3': 'Upload PDF to NotebookLM: one source = multiple pages',
  'bookmark.pdfSaved': 'PDF saved. Upload to NotebookLM as a source.',

  // ── RescueBanner ──
  'rescue.scanning': 'Scanning failed sources...',
  'rescue.foundFailed': 'Found {count} failed source imports',
  'rescue.rescuing': 'Rescuing...',
  'rescue.done': 'Rescue complete: {success} succeeded, {failed} failed',
  'rescue.rescue': 'Rescue',

  // ── BatchImport ──
  'batch.getTabsFailed': 'Failed to get tabs',
  'batch.batchFailed': 'Batch import failed',
  'batch.importAllTabs': 'Import all open tabs',
  'batch.urlList': 'URL List',
  'batch.placeholder': 'One URL per line, or comma-separated',
  'batch.batchImport': 'Batch Import',

  // ── MorePanel ──
  'more.rssImport': 'RSS Import',
  'more.rssFailed': 'RSS parsing failed',
  'more.enterRssLink': 'Please enter an RSS link',
  'more.selectedArticles': '{selected}/{total} selected',
  'more.importSelected': 'Import Selected',
  'more.rssFormats': 'Formats: /feed, /rss, /atom.xml, medium.com/feed/@user',
  'more.about': 'About',
  'more.ytChannel': 'Green Train Podcast',
  'more.ytDesc': 'YouTube Channel · Tutorials',
  'more.ghDesc': 'Open Source · Star',
  'more.madeBy': 'Green Train Podcast',

  // ── RssImport ──
  'rss.feedUrl': 'RSS Feed URL',
  'rss.enterFeedUrl': 'Please enter an RSS feed URL',
  'rss.parseFailed': 'Failed to parse RSS. Check if the URL is correct.',
  'rss.selectedArticles': '{selected}/{total} articles selected',
  'rss.importSelected': 'Import selected ({count})',
  'rss.tipTitle': 'Common RSS URL formats:',
  'rss.tipBlog': 'Blog: /feed, /rss, /atom.xml',
  'rss.tipMedium': 'Medium: medium.com/feed/@username',
  'rss.tipSubstack': 'Substack: xxx.substack.com/feed',

  // ── ImportPanel ──
  'panel.single': 'Single',
  'panel.batch': 'Batch',
  'panel.cannotImportNlm': 'Cannot import NotebookLM pages',
  'panel.rssAtomLink': 'RSS / Atom Link',
  'panel.supportedFormats': 'Supports: web articles, Substack, WeChat, PDF links (auto-rescue failed imports)',
};

export type TranslationKey = keyof typeof zh;

function detectLocale(): Locale {
  try {
    const lang = navigator.language;
    if (lang.startsWith('zh')) return 'zh';
    return 'en';
  } catch {
    return 'zh';
  }
}

const STORAGE_KEY = 'jetpack_locale';

let currentLocale: Locale | null = null;
const listeners = new Set<() => void>();

function loadLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh' || stored === 'en') return stored;
  } catch { /* ignore */ }
  return detectLocale();
}

function getLocale(): Locale {
  if (!currentLocale) {
    currentLocale = loadLocale();
  }
  return currentLocale;
}

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  try { localStorage.setItem(STORAGE_KEY, locale); } catch { /* ignore */ }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function getSnapshot(): Locale {
  return getLocale();
}

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const locale = getLocale();
  const dict = locale === 'en' ? en : zh;
  let text = dict[key] || zh[key];
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getSnapshot);
  const boundT = useMemo(() => {
    // Re-create t reference when locale changes so components re-render
    return (key: TranslationKey, params?: Record<string, string | number>) => t(key, params);
  }, [locale]);
  return { t: boundT, locale, setLocale };
}
