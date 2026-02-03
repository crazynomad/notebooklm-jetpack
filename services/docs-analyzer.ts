import type { DocFramework, DocPageItem, DocSiteInfo } from '@/lib/types';

// Detect the documentation framework from DOM
export function detectFramework(doc: Document): DocFramework {
  // Docusaurus detection
  const docusaurusGenerator = doc.querySelector('meta[name="generator"][content*="Docusaurus"]');
  const docusaurusClass = doc.querySelector('.docusaurus, [class*="docusaurus"]');
  const docusaurusGlobal =
    typeof (window as unknown as { __DOCUSAURUS__?: unknown }).__DOCUSAURUS__ !== 'undefined';
  if (docusaurusGenerator || docusaurusClass || docusaurusGlobal) {
    return 'docusaurus';
  }

  // MkDocs / Material for MkDocs detection
  const mkdocsGenerator = doc.querySelector('meta[name="generator"][content*="mkdocs"]');
  const mkdocsNav = doc.querySelector('.md-nav, .md-sidebar');
  if (mkdocsGenerator || mkdocsNav) {
    return 'mkdocs';
  }

  // GitBook detection
  const gitbookClass = doc.querySelector('[class*="gitbook-"]');
  const gitbookGlobal =
    typeof (window as unknown as { GITBOOK_RUNTIME?: unknown }).GITBOOK_RUNTIME !== 'undefined';
  if (gitbookClass || gitbookGlobal) {
    return 'gitbook';
  }

  // VitePress detection
  const vitepressSidebar = doc.querySelector('.VPSidebar, .vp-sidebar');
  const vitepressClass = doc.querySelector('[class*="vitepress"], .vp-doc');
  if (vitepressSidebar || vitepressClass) {
    return 'vitepress';
  }

  // ReadTheDocs / Sphinx detection
  const sphinxSidebar = doc.querySelector('.sphinxsidebar, .wy-nav-side');
  const sphinxContent = doc.querySelector('.rst-content, .document');
  const rtdGenerator = doc.querySelector('meta[name="generator"][content*="Sphinx"]');
  if (sphinxSidebar || sphinxContent || rtdGenerator) {
    return 'readthedocs';
  }

  return 'unknown';
}

// Extract pages based on framework type
export function extractPages(
  doc: Document,
  framework: DocFramework,
  baseUrl: string
): DocPageItem[] {
  switch (framework) {
    case 'docusaurus':
      return extractDocusaurusPages(doc, baseUrl);
    case 'mkdocs':
      return extractMkDocsPages(doc, baseUrl);
    case 'gitbook':
      return extractGitBookPages(doc, baseUrl);
    case 'vitepress':
      return extractVitePressPages(doc, baseUrl);
    case 'readthedocs':
      return extractReadTheDocsPages(doc, baseUrl);
    default:
      return extractGenericPages(doc, baseUrl);
  }
}

// Resolve relative URL to absolute
function resolveUrl(href: string, baseUrl: string): string {
  try {
    return new URL(href, baseUrl).href;
  } catch {
    return href;
  }
}

// Check if URL is within the same site
function isSameSite(url: string, baseUrl: string): boolean {
  try {
    const urlObj = new URL(url);
    const baseObj = new URL(baseUrl);
    return urlObj.hostname === baseObj.hostname;
  } catch {
    return false;
  }
}

// Deduplicate pages by URL
function deduplicatePages(pages: DocPageItem[]): DocPageItem[] {
  const seen = new Set<string>();
  return pages.filter((page) => {
    const normalized = page.url.replace(/\/$/, '').replace(/#.*$/, '');
    if (seen.has(normalized)) {
      return false;
    }
    seen.add(normalized);
    return true;
  });
}

// Extract Docusaurus sidebar links
function extractDocusaurusPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // Try multiple selectors for Docusaurus sidebar
  const selectors = [
    '.theme-doc-sidebar-menu a',
    '.menu__list a',
    'nav[aria-label="Docs sidebar"] a',
    '.sidebar a',
    'aside a[href]',
  ];

  for (const selector of selectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length > 0) {
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        // Determine level from nesting
        let level = 0;
        let parent = link.parentElement;
        while (parent) {
          if (parent.matches('.menu__list')) level++;
          parent = parent.parentElement;
        }

        // Get section from parent category
        const category = link.closest('.menu__list-item')?.querySelector('.menu__link--sublist');
        const section = category?.textContent?.trim();

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: Math.min(level, 3),
          section,
        });
      });
      break;
    }
  }

  return deduplicatePages(pages);
}

// Extract MkDocs / Material for MkDocs sidebar links
function extractMkDocsPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // Material for MkDocs selectors
  const selectors = [
    '.md-nav__link',
    '.md-sidebar a',
    'nav.md-nav a',
    '.toc a',
  ];

  for (const selector of selectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length > 0) {
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        // Determine level from nesting
        let level = 0;
        let parent = link.parentElement;
        while (parent) {
          if (parent.matches('.md-nav__item--nested, .md-nav')) level++;
          parent = parent.parentElement;
        }

        // Get section from toggle label
        const section = link.closest('.md-nav__item--nested')?.querySelector('.md-nav__link')?.textContent?.trim();

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: Math.min(level - 1, 3),
          section,
        });
      });
      break;
    }
  }

  return deduplicatePages(pages);
}

// Extract GitBook sidebar links
function extractGitBookPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // GitBook selectors
  const selectors = [
    '[data-testid="page-tree"] a',
    '.gitbook-root aside a',
    'nav[aria-label] a',
    'aside a[href]',
  ];

  for (const selector of selectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length > 0) {
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        // GitBook uses flat structure typically
        const level = 0;

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level,
        });
      });
      break;
    }
  }

  return deduplicatePages(pages);
}

// Extract VitePress sidebar links
function extractVitePressPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // VitePress selectors
  const selectors = [
    '.VPSidebarItem a',
    '.vp-sidebar a',
    '.sidebar a',
    'aside.VPSidebar a',
  ];

  for (const selector of selectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length > 0) {
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        // Determine level from nesting
        let level = 0;
        let parent = link.parentElement;
        while (parent) {
          if (parent.matches('.VPSidebarItem')) level++;
          parent = parent.parentElement;
        }

        // Get section from group
        const section = link.closest('.VPSidebarGroup')?.querySelector('.title')?.textContent?.trim();

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: Math.min(level - 1, 3),
          section,
        });
      });
      break;
    }
  }

  return deduplicatePages(pages);
}

// Extract ReadTheDocs / Sphinx sidebar links
function extractReadTheDocsPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // RTD / Sphinx selectors
  const selectors = [
    '.wy-menu-vertical a',
    '.sphinxsidebarwrapper a',
    '.toctree-wrapper a',
    'nav.wy-nav-side a',
  ];

  for (const selector of selectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length > 0) {
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        // Determine level from nesting
        let level = 0;
        let parent = link.parentElement;
        while (parent) {
          if (parent.matches('ul')) level++;
          parent = parent.parentElement;
        }

        // Get section from caption
        const section = link.closest('.toctree-l1')?.querySelector('.caption')?.textContent?.trim();

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: Math.min(level - 2, 3),
          section,
        });
      });
      break;
    }
  }

  return deduplicatePages(pages);
}

// Generic extraction for unknown frameworks
function extractGenericPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // Try common sidebar/nav patterns
  const selectors = [
    'aside a[href]',
    'nav a[href]',
    '.sidebar a[href]',
    '.navigation a[href]',
    '.toc a[href]',
  ];

  for (const selector of selectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length > 5) {
      // Only use if we find a reasonable number of links
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: 0,
        });
      });
      break;
    }
  }

  return deduplicatePages(pages);
}

// Analyze the current document and return site info
export function analyzeDocSite(doc: Document, baseUrl: string): DocSiteInfo {
  const framework = detectFramework(doc);
  const pages = extractPages(doc, framework, baseUrl);
  const title = doc.title || new URL(baseUrl).hostname;

  return {
    baseUrl,
    title,
    framework,
    pages,
  };
}
