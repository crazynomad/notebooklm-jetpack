import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractX } from '@/lib/extractors';
import { X_SELECTORS, NOTEBOOKLM_SELECTORS, MONITORED_SELECTORS } from '@/lib/selectors';

const loadFixture = (name: string): Document => {
  const html = readFileSync(resolve(__dirname, '../fixtures', name), 'utf-8');
  return new DOMParser().parseFromString(html, 'text/html');
};

describe('X/Twitter selectors + extraction', () => {
  it('extracts a tweet, preferring a non-empty document.title', () => {
    const doc = loadFixture('x-tweet.html');
    const result = extractX(doc, 'Andrew Ng on X: "Loop engineering" / X');

    expect(result.success).toBe(true);
    expect(result.title).toBe('Andrew Ng'); // " on X:..." and " / X" stripped
    expect(result.content).toContain('Loop engineering');
  });

  it('falls back to "Author: snippet" when document.title is empty (real X SPA case)', () => {
    // Reproduces the live finding: X often leaves document.title empty right
    // after SPA navigation, so a tweet must be titled from the author block.
    const doc = loadFixture('x-tweet.html');
    const result = extractX(doc, ''); // empty doc title

    expect(result.success).toBe(true);
    expect(result.title).toMatch(/^Andrew Ng: /); // author + snippet, not "x.com"
    expect(result.title).not.toBe('');
  });

  it('extracts a long-form article, titled from the article-title testid', () => {
    const doc = loadFixture('x-article.html');
    // Article title comes from the testid even when document.title is empty.
    const result = extractX(doc, '');

    expect(result.success).toBe(true);
    expect(result.title).toBe('来自 Codex 官方团队的分享：如何把 Codex 用到极致');
    expect(result.content).toContain('coding agents');
    expect(result.content!.length).toBeGreaterThanOrEqual(100);
  });

  it('reports failure when no known selector matches (simulates an X UI change)', () => {
    const doc = new DOMParser().parseFromString(
      '<article><div data-testid="renamed-by-x">hidden</div></article>',
      'text/html',
    );
    const result = extractX(doc, 'whatever / X');
    expect(result.success).toBe(false);
  });

  it('the tweetText + author selectors still resolve against the frozen DOM', () => {
    // Directly asserts the registry selectors — the things the canary also checks.
    const doc = loadFixture('x-tweet.html');
    expect(doc.querySelectorAll(X_SELECTORS.tweetText).length).toBeGreaterThanOrEqual(1);
    expect(doc.querySelector(X_SELECTORS.tweetAuthor)).not.toBeNull();
  });
});

describe('selector registry integrity', () => {
  it('every monitored selector points at a defined registry value', () => {
    const known = new Set<string>([
      ...Object.values(X_SELECTORS),
      ...NOTEBOOKLM_SELECTORS.addSourceButton,
      NOTEBOOKLM_SELECTORS.sourceContainer,
    ]);
    for (const m of MONITORED_SELECTORS) {
      expect(m.selector, `${m.site}/${m.name}`).toBeTruthy();
      // Selector strings should be non-trivial CSS, not accidental empties.
      expect(m.selector.length).toBeGreaterThan(2);
    }
    // Sanity: the load-bearing selectors are catalogued.
    expect(known.has(X_SELECTORS.tweetText)).toBe(true);
  });
});
