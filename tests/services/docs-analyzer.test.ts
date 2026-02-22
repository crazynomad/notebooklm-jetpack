import { describe, it, expect } from 'vitest';
import { detectFramework, extractPages, analyzeDocSite } from '@/services/docs-analyzer';
import type { DocFramework } from '@/lib/types';

function createDoc(html: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
}

describe('detectFramework', () => {
  it('detects Docusaurus via meta tag', () => {
    const doc = createDoc('<html><head><meta name="generator" content="Docusaurus v2.4.1"></head><body></body></html>');
    expect(detectFramework(doc)).toBe('docusaurus');
  });

  it('detects Docusaurus via class', () => {
    const doc = createDoc('<html><body><div class="docusaurus"></div></body></html>');
    expect(detectFramework(doc)).toBe('docusaurus');
  });

  it('detects MkDocs via meta tag', () => {
    const doc = createDoc('<html><head><meta name="generator" content="mkdocs-1.5"></head><body></body></html>');
    expect(detectFramework(doc)).toBe('mkdocs');
  });

  it('detects MkDocs via sidebar class', () => {
    const doc = createDoc('<html><body><nav class="md-nav"></nav></body></html>');
    expect(detectFramework(doc)).toBe('mkdocs');
  });

  it('detects GitBook via class', () => {
    const doc = createDoc('<html><body><div class="gitbook-root"></div></body></html>');
    expect(detectFramework(doc)).toBe('gitbook');
  });

  it('detects VitePress via sidebar', () => {
    const doc = createDoc('<html><body><div class="VPSidebar"></div></body></html>');
    expect(detectFramework(doc)).toBe('vitepress');
  });

  it('detects ReadTheDocs/Sphinx via sidebar', () => {
    const doc = createDoc('<html><body><div class="wy-nav-side"></div></body></html>');
    expect(detectFramework(doc)).toBe('readthedocs');
  });

  it('detects Sphinx via meta generator', () => {
    const doc = createDoc('<html><head><meta name="generator" content="Sphinx 7.0"></head><body></body></html>');
    expect(detectFramework(doc)).toBe('readthedocs');
  });

  it('detects Mintlify via mintcdn.com CDN + sidebar-group (multi-signal)', () => {
    const doc = createDoc('<html><body><div class="sidebar-group"></div><img src="https://mintcdn.com/example/logo.png" /></body></html>');
    expect(detectFramework(doc)).toBe('mintlify');
  });

  it('detects Mintlify via __NEXT_DATA__ with theme:mint', () => {
    const doc = createDoc('<html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"docsConfig":{"theme":"mint","$schema":"https://mintlify.com/docs.json"}}}</script></body></html>');
    expect(detectFramework(doc)).toBe('mintlify');
  });

  it('detects Mintlify via meta generator tag alone', () => {
    const doc = createDoc('<html><head><meta name="generator" content="Mintlify"></head><body></body></html>');
    expect(detectFramework(doc)).toBe('mintlify');
  });

  it('returns unknown for unrecognized sites', () => {
    const doc = createDoc('<html><body><p>Hello world</p></body></html>');
    expect(detectFramework(doc)).toBe('unknown');
  });
});

describe('extractPages', () => {
  it('extracts Docusaurus sidebar links', () => {
    const doc = createDoc(`<html><body>
      <ul class="menu__list">
        <li class="menu__list-item">
          <a class="menu__link" href="/docs/intro">Introduction</a>
        </li>
        <li class="menu__list-item">
          <a class="menu__link" href="/docs/getting-started">Getting Started</a>
        </li>
      </ul>
    </body></html>`);

    const pages = extractPages(doc, 'docusaurus', 'https://docs.example.com');
    expect(pages.length).toBe(2);
    expect(pages[0].url).toBe('https://docs.example.com/docs/intro');
    expect(pages[0].title).toBe('Introduction');
    expect(pages[1].url).toBe('https://docs.example.com/docs/getting-started');
  });

  it('deduplicates pages by URL', () => {
    const doc = createDoc(`<html><body>
      <ul class="menu__list">
        <li><a class="menu__link" href="/docs/intro">Intro</a></li>
        <li><a class="menu__link" href="/docs/intro">Intro Again</a></li>
        <li><a class="menu__link" href="/docs/intro/">Intro Trailing Slash</a></li>
      </ul>
    </body></html>`);

    const pages = extractPages(doc, 'docusaurus', 'https://docs.example.com');
    expect(pages.length).toBe(1);
  });

  it('skips anchor-only and javascript links', () => {
    const doc = createDoc(`<html><body>
      <ul class="menu__list">
        <li><a class="menu__link" href="#section">Anchor</a></li>
        <li><a class="menu__link" href="javascript:void(0)">JS</a></li>
        <li><a class="menu__link" href="/docs/real">Real</a></li>
      </ul>
    </body></html>`);

    const pages = extractPages(doc, 'docusaurus', 'https://docs.example.com');
    expect(pages.length).toBe(1);
    expect(pages[0].title).toBe('Real');
  });

  it('skips external links', () => {
    const doc = createDoc(`<html><body>
      <ul class="menu__list">
        <li><a class="menu__link" href="https://other.com/page">External</a></li>
        <li><a class="menu__link" href="/docs/internal">Internal</a></li>
      </ul>
    </body></html>`);

    const pages = extractPages(doc, 'docusaurus', 'https://docs.example.com');
    expect(pages.length).toBe(1);
    expect(pages[0].title).toBe('Internal');
  });

  it('extracts generic pages from aside links', () => {
    const links = Array.from({ length: 10 }, (_, i) =>
      `<a href="/page-${i}">Page ${i}</a>`
    ).join('');
    const doc = createDoc(`<html><body><aside>${links}</aside></body></html>`);

    const pages = extractPages(doc, 'unknown', 'https://docs.example.com');
    expect(pages.length).toBe(10);
  });
});

describe('analyzeDocSite', () => {
  it('returns complete DocSiteInfo', () => {
    const doc = createDoc(`<html>
      <head><title>My Docs</title><meta name="generator" content="Docusaurus v3"></head>
      <body>
        <ul class="menu__list">
          <li><a class="menu__link" href="/docs/intro">Intro</a></li>
        </ul>
      </body>
    </html>`);

    const result = analyzeDocSite(doc, 'https://docs.example.com');
    expect(result.framework).toBe('docusaurus');
    expect(result.title).toBe('My Docs');
    expect(result.baseUrl).toBe('https://docs.example.com');
    expect(result.pages.length).toBe(1);
  });
});
