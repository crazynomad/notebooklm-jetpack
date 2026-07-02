import { X_SELECTORS } from './selectors';

export interface ExtractResult {
  success: boolean;
  title?: string;
  content?: string;
  error?: string;
}

/**
 * Pure X/Twitter content extraction.
 *
 * This MIRRORS the X branch of `_tabExtractorFunction` in background.ts. That
 * function is injected into page context via `chrome.scripting.executeScript`,
 * which serialises it and strips all module imports — so it can't `import` the
 * selector registry or share this code directly. This importable copy exists so
 * the fragile bits (the `data-testid` selectors + extraction rules) can be
 * unit-tested against frozen HTML fixtures. Keep the two in sync; the fixture
 * tests are the tripwire that catches drift.
 *
 * Note: uses `textContent` (jsdom implements it; `innerText` it does not). The
 * injected copy uses `innerText` for better whitespace fidelity in a real DOM.
 */
export function extractX(doc: Document, docTitle: string, sel = X_SELECTORS): ExtractResult {
  const cleanTitle = (raw: string) => raw.replace(/ \/ X$/, '').replace(/ on X:.*$/, '').trim();

  // Long-form X Article
  const article = doc.querySelector(sel.articleContent);
  if (article) {
    const titleEl = doc.querySelector(sel.articleTitle);
    const title = titleEl?.textContent?.trim() || cleanTitle(docTitle);
    const content = article.textContent?.trim() || '';
    if (content.length >= 100) return { success: true, title, content };
  }

  // Normal tweet / thread
  const tweets = doc.querySelectorAll(sel.tweetText);
  if (tweets.length > 0) {
    const parts: string[] = [];
    tweets.forEach((el) => {
      const text = el.textContent?.trim();
      if (text && text.length > 10) parts.push(text);
    });
    const content = parts.join('\n\n');
    if (content.length >= 50) return { success: true, title: cleanTitle(docTitle), content };
  }

  return { success: false, error: 'X.com: 未找到文章或推文内容' };
}
