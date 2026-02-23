/**
 * Offscreen document — provides DOM environment for HTML→Markdown conversion.
 * Service workers can't use DOMParser/Turndown reliably, so we delegate here.
 */
import TurndownService from 'turndown';

function createTurndownService(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
  });

  // DevSite: <pre class="devsite-click-to-copy"> → fenced code block
  td.addRule('devsiteCode', {
    filter: (node) =>
      node.nodeName === 'PRE' &&
      (node.getAttribute('class') || '').includes('devsite-click-to-copy'),
    replacement: (_content, node) => {
      const lang = (node.getAttribute('syntax') || '').toLowerCase();
      const codeEl = (node as Element).querySelector('code') || node;
      const text = codeEl.textContent || '';
      return `\n\n\`\`\`${lang}\n${text.trim()}\n\`\`\`\n\n`;
    },
  });

  td.addRule('removeStyle', {
    filter: 'style',
    replacement: () => '',
  });

  td.addRule('removeDevsiteUI', {
    filter: (node) => {
      const tag = node.nodeName.toLowerCase();
      return (
        tag.startsWith('devsite-') &&
        tag !== 'devsite-code' &&
        tag !== 'devsite-content'
      );
    },
    replacement: () => '',
  });

  td.addRule('removeNavElements', {
    filter: (node) => {
      const cl = node.getAttribute('class') || '';
      return /breadcrumb|sidebar|devsite-nav|devsite-toc/.test(cl);
    },
    replacement: () => '',
  });

  // Substack: remove subscribe buttons, share widgets, like buttons
  td.addRule('removeSubstackNoise', {
    filter: (node) => {
      const cl = node.getAttribute('class') || '';
      const testId = node.getAttribute('data-testid') || '';
      return (
        /subscribe-widget|subscription-widget|button-wrapper|like-button|share-dialog|post-ufi|paywall/.test(cl) ||
        /paywall|navbar/.test(testId)
      );
    },
    replacement: () => '',
  });

  // Substack: image captions are in <figcaption>
  td.addRule('substackFigcaption', {
    filter: 'figcaption',
    replacement: (content) => content.trim() ? `\n*${content.trim()}*\n` : '',
  });

  return td;
}

// Content selectors in priority order
const CONTENT_SELECTORS = [
  '.devsite-article-body',
  // Substack
  '.available-content .body.markup',
  '.available-content',
  '.body.markup',
  // General
  '.markdown-body',
  'article [itemprop="articleBody"]',
  'article',
  'main',
  '[role="main"]',
  '#content',
  '.prose',
  '.content',
];

// Elements to remove before conversion
const REMOVE_SELECTORS = [
  'script', 'style', 'nav', 'footer', 'header',
  '.sidebar', '.toc', '.breadcrumb',
  '.nocontent', '[role="navigation"]',
  // DevSite
  '.devsite-article-meta', '.devsite-breadcrumb-list',
  'devsite-toc', 'devsite-page-rating', 'devsite-thumbs-rating',
  'devsite-feedback', 'devsite-bookmark', 'devsite-actions',
  '.devsite-banner', '.devsite-collections-banner',
  // Substack
  '[data-testid="paywall"]',              // paywall boundary + subscription prompts
  '.subscription-widget-wrap',
  '.subscribe-widget',
  '.subscribe-prompt',
  '.button-wrapper',
  '.like-button-container',
  '.post-ufi',                            // like/comment/share bar
  '.post-footer',
  '.comments-section',
  '.recommendation-container',
  '.footer-wrap',
  '.pencraft.pc-display-flex.pc-gap-4',   // Substack nav buttons (Previous/Next)
  '.share-dialog',
  '.social-share',
  '[data-testid="navbar"]',
  '.header-anchor-widget',
].join(',');

function htmlToMarkdown(html: string): { markdown: string; title: string } {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Find content element
  let el: Element | null = null;
  for (const s of CONTENT_SELECTORS) {
    el = doc.querySelector(s);
    if (el) break;
  }
  if (!el) el = doc.body;

  // Remove non-content elements
  el.querySelectorAll(REMOVE_SELECTORS).forEach(e => e.remove());

  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';

  // Convert to markdown
  const td = createTurndownService();
  let markdown = td.turndown(el.innerHTML);

  // Post-process
  markdown = markdown
    .replace(/\.dcc-[\s\S]*?\n\n/g, '\n\n')
    // Substack: remove trailing subscription prompts
    .replace(/Continue reading this post for free.*$/s, '')
    .replace(/Claim my free post.*$/s, '')
    .replace(/Already a paid subscriber\?.*$/s, '')
    .replace(/Get more from .* in the Substack app.*$/s, '')
    .replace(/Start your Substack.*$/s, '')
    .replace(/This site requires JavaScript.*$/s, '')
    .replace(/© \d{4} .*?[·∙].*?Terms.*$/s, '')
    // General cleanup
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { markdown, title };
}

// Listen for messages from background service worker
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'HTML_TO_MARKDOWN') {
    try {
      const result = htmlToMarkdown(msg.html);
      sendResponse({ success: true, ...result });
    } catch (err) {
      console.error('[offscreen] htmlToMarkdown error:', err);
      sendResponse({ success: false, error: String(err) });
    }
    return true;
  }
});

console.log('[offscreen] Ready');
