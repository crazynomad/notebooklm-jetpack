import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { extractX, articleImagesMarkdown } from '@/lib/extractors';
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

  it('appends X article images as Markdown when includeImages=true, deduped and pbs-only (issue #34)', () => {
    const doc = loadFixture('x-article.html');
    const result = extractX(doc, '', X_SELECTORS, true);

    expect(result.success).toBe(true);
    // pbs.twimg.com image is preserved as Markdown alongside the text body.
    expect(result.content).toContain(
      '![Codex architecture diagram](https://pbs.twimg.com/media/Gabc123?format=jpg&name=medium)',
    );
    // The same src appears twice in the fixture but must be emitted once.
    const occurrences = result.content!.split('https://pbs.twimg.com/media/Gabc123').length - 1;
    expect(occurrences).toBe(1);
    // Emoji/avatar images from abs*.twimg.com are excluded.
    expect(result.content).not.toContain('abs-0.twimg.com');
    // Images come after the text body, not before it.
    expect(result.content!.indexOf('coding agents')).toBeLessThan(
      result.content!.indexOf('pbs.twimg.com'),
    );
  });

  it('does NOT append image Markdown on the import-as-text path (includeImages defaults false)', () => {
    // Guards the regression where raw ![](…) syntax leaked into NotebookLM text
    // sources: the text-import path must get clean prose, images only in export.
    const doc = loadFixture('x-article.html');
    const result = extractX(doc, ''); // no includeImages → text only

    expect(result.success).toBe(true);
    expect(result.content).toContain('coding agents');
    expect(result.content).not.toContain('pbs.twimg.com');
    expect(result.content).not.toContain('![');
  });

  it('articleImagesMarkdown scopes to its article element and ignores a sibling container', () => {
    const doc = new DOMParser().parseFromString(
      `<div id="a" data-testid="twitterArticleRichTextView">
         <img src="https://pbs.twimg.com/media/inA?format=jpg" alt="in A" />
       </div>
       <div id="b" data-testid="twitterArticleRichTextView">
         <img src="https://pbs.twimg.com/media/inB?format=jpg" alt="in B" />
       </div>`,
      'text/html',
    );
    const md = articleImagesMarkdown(doc.querySelector('#a')!);
    expect(md).toContain('pbs.twimg.com/media/inA');
    expect(md).not.toContain('pbs.twimg.com/media/inB'); // sibling article's image excluded
  });

  it('articleImagesMarkdown returns empty string when an article has no images', () => {
    const doc = new DOMParser().parseFromString(
      '<div data-testid="twitterArticleRichTextView"><p>text only, no images here</p></div>',
      'text/html',
    );
    expect(articleImagesMarkdown(doc.querySelector('[data-testid="twitterArticleRichTextView"]')!)).toBe('');
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
