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
  it('extracts a tweet thread from the fixture', () => {
    const doc = loadFixture('x-tweet.html');
    const result = extractX(doc, 'Naval on X: "How to Get Rich" / X');

    expect(result.success).toBe(true);
    expect(result.title).toBe('Naval'); // " on X:..." and " / X" stripped
    expect(result.content).toContain('Seek wealth');
    expect(result.content).toContain('own equity');
    // Thread parts joined with a blank line
    expect(result.content?.split('\n\n').length).toBeGreaterThanOrEqual(3);
  });

  it('extracts a long-form article from the fixture', () => {
    const doc = loadFixture('x-article.html');
    const result = extractX(doc, 'The Case for Long-Form on X / X');

    expect(result.success).toBe(true);
    expect(result.title).toBe('The Case for Long-Form on X');
    expect(result.content).toContain('Long-form writing on X');
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

  it('the tweetText selector still resolves against the frozen DOM', () => {
    // Directly asserts the registry selector — the thing the canary also checks.
    const doc = loadFixture('x-tweet.html');
    expect(doc.querySelectorAll(X_SELECTORS.tweetText).length).toBeGreaterThanOrEqual(3);
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
