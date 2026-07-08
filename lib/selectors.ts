/**
 * Central DOM-selector registry.
 *
 * Every selector here targets THIRD-PARTY DOM that we do not control — X/Twitter,
 * NotebookLM, WeChat, Huawei Developer. Those sites reship their UI without notice,
 * and when they do, a `data-testid` or a Material CSS class quietly stops matching
 * and a feature silently breaks. Centralising the selectors lets us:
 *   1. Keep ONE source of truth shared by runtime code and tests.
 *   2. Run a periodic canary (`scripts/check-selectors.mjs`) against live pages
 *      and get told the moment a selector stops resolving.
 *   3. Regression-test the extraction logic against frozen HTML fixtures.
 *
 * IMPORTANT — serialisation constraint:
 *   The X selectors are injected into page context via
 *   `chrome.scripting.executeScript({ func, args: [X_SELECTORS] })`, which uses
 *   structured clone. Values MUST stay JSON-serialisable: plain strings/arrays,
 *   no functions, no RegExp objects. Keep it that way or injection throws.
 */

// ── X.com / Twitter ──────────────────────────────────────────────────────────
// Long-form Articles + normal tweet threads. Injected into the page via args.
export const X_SELECTORS = {
  /** Long-form "X Article" rich-text body. */
  articleContent: '[data-testid="twitterArticleRichTextView"]',
  /** Content images inside a long-form article body. innerText/textContent drop
   *  <img>, so images are extracted separately; callers filter to pbs.twimg.com
   *  to keep article media and exclude emoji/avatars. */
  articleImage: '[data-testid="twitterArticleRichTextView"] img',
  /** Long-form article title. */
  articleTitle: '[data-testid="twitter-article-title"]',
  /** Individual tweet body text (thread extraction joins these). */
  tweetText: 'article [data-testid="tweetText"]',
  /** Author block ("Display Name @handle · time"); used to title a tweet when
   *  document.title is empty (common right after SPA navigation). */
  tweetAuthor: 'article [data-testid="User-Name"]',
} as const;

// ── NotebookLM ────────────────────────────────────────────────────────────────
// The load-bearing selectors the whole import flow depends on. Catalogued here so
// the canary + tests watch them; runtime call sites in notebooklm.content.ts still
// carry their own fallbacks (see note in that file — full DRY-ing is a separate,
// discussed refactor of the core import flow).
export const NOTEBOOKLM_SELECTORS = {
  addSourceButton: [
    '.add-source-button',
    'button[aria-label*="Add source"]',
    'button[aria-label*="添加来源"]',
  ],
  dialog: ['mat-dialog-container', '.mat-mdc-dialog-container', '[role="dialog"]'],
  submitButton: ['mat-dialog-container .submit-button'],
  sourceContainer: '.single-source-container',
  sourceErrorContainer: '.single-source-error-container',
  sourceTitle: '.source-title',
  scrollArea: '.scroll-area-desktop',
} as const;

// ── WeChat / Huawei (rescue-path extractors) ─────────────────────────────────
export const WECHAT_SELECTORS = {
  content: ['#js_content', '.rich_media_content', 'article', '.rich_media_area_primary'],
  title: ['.rich_media_title', '#activity-name', 'h1'],
} as const;

export const HUAWEI_SELECTORS = {
  content: ['.markdown-body', '#mark .idpContent', '.document-content-html', '#document-content .layout-content'],
} as const;

/**
 * Flat catalogue the live canary iterates. Each entry names a selector, an example
 * PUBLIC page where it should resolve, and how many matches prove it still works.
 * `sample` pages are used by `scripts/check-selectors.mjs`; they must be publicly
 * reachable in a logged-in browser session (X requires login to render content).
 */
export interface MonitoredSelector {
  site: 'x' | 'notebooklm';
  name: string;
  selector: string;
  /** Minimum element count that means "still working". */
  minMatches: number;
  /** Example page the canary loads to check this selector against live DOM. */
  sample?: string;
  notes?: string;
}

export const MONITORED_SELECTORS: MonitoredSelector[] = [
  {
    site: 'x',
    name: 'tweetText',
    selector: X_SELECTORS.tweetText,
    minMatches: 1,
    sample: 'https://x.com/naval/status/1002103360646823936',
    notes: 'Normal tweet / thread body. Breaks if X renames the tweetText testid.',
  },
  {
    site: 'x',
    name: 'articleContent',
    selector: X_SELECTORS.articleContent,
    minMatches: 1,
    notes: 'Long-form X Article body. Provide a current article URL as sample when auditing.',
  },
  {
    site: 'x',
    name: 'articleImage',
    selector: X_SELECTORS.articleImage,
    minMatches: 0,
    notes: 'Content images inside an X Article body (pbs.twimg.com). minMatches 0 = an image-free article is still valid; canary only fails on selector-parse errors here.',
  },
  {
    site: 'notebooklm',
    name: 'addSourceButton',
    selector: NOTEBOOKLM_SELECTORS.addSourceButton[0],
    minMatches: 1,
    sample: 'https://notebooklm.google.com/',
    notes: 'Primary "add source" entry point. If this breaks, ALL imports break.',
  },
  {
    site: 'notebooklm',
    name: 'sourceContainer',
    selector: NOTEBOOKLM_SELECTORS.sourceContainer,
    minMatches: 0,
    sample: 'https://notebooklm.google.com/',
    notes: 'Source rows. minMatches 0 = an empty notebook is still valid; canary only fails on selector-parse errors here.',
  },
];
