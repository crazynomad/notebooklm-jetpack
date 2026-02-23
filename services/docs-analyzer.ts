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

  // Yuque detection
  const yuqueData = doc.querySelector('[data-kumuhana], [data-yuque]');
  const isYuque = doc.documentElement.getAttribute('data-kumuhana') !== null
    || doc.querySelector('meta[content*="yuque"]') !== null
    || (doc.querySelector('script')?.textContent || '').includes('yuque');
  if (yuqueData || isYuque || doc.location?.hostname?.includes('yuque.com')) {
    return 'yuque';
  }

  // WeChat developer docs detection
  if (doc.location?.hostname?.includes('developers.weixin.qq.com') ||
      doc.querySelector('.sidebar__wrp') !== null) {
    return 'wechat';
  }

  // HarmonyOS docs detection
  if (doc.location?.hostname?.includes('developer.huawei.com') ||
      doc.querySelector('[class*="harmonyos"]') !== null) {
    return 'huawei';
  }

  // Mintlify detection — AI-native multi-signal approach
  // Signal 1: meta generator tag
  const mintlifyGenerator = doc.querySelector('meta[name="generator"][content*="Mintlify"]');
  // Signal 2: old-style sidebar class
  const mintlifySidebar = doc.querySelector('.sidebar-group');
  // Signal 3: mintlify in asset URLs
  const mintlifyAssets = doc.querySelector('link[href*="mintlify"], script[src*="mintlify"]');
  // Signal 4: mintcdn.com CDN (Mintlify's image/asset CDN)
  const mintlifyCdn = doc.querySelector('img[src*="mintcdn.com"], link[href*="mintcdn.com"], img[srcset*="mintcdn.com"]');
  // Signal 5: __NEXT_DATA__ containing Mintlify markers (theme:"mint", $schema with mintlify.com)
  let mintlifyNextData = false;
  try {
    const nextDataScript = doc.getElementById('__NEXT_DATA__');
    if (nextDataScript) {
      const text = nextDataScript.textContent || '';
      // Check for Mintlify-specific config markers in the JSON
      mintlifyNextData = text.includes('"theme":"mint"') ||
        text.includes('"$schema":"https://mintlify.com') ||
        text.includes('mintlify.com/docs.json');
    }
  } catch { /* ignore parsing errors */ }
  // Signal 6: mintlify class names in DOM
  const mintlifyClasses = doc.querySelector('[class*="mintlify"], [data-mintlify]');

  // Score-based detection: 1 strong signal or 2+ weak signals = Mintlify
  const mintlifyScore = (mintlifyGenerator ? 2 : 0) +
    (mintlifyNextData ? 2 : 0) +
    (mintlifyCdn ? 2 : 0) +
    (mintlifyAssets ? 1 : 0) +
    (mintlifySidebar ? 1 : 0) +
    (mintlifyClasses ? 1 : 0);
  if (mintlifyScore >= 2) {
    return 'mintlify';
  }

  // Google DevSite detection (developer.chrome.com, developer.android.com, etc.)
  const devsiteBookNav = doc.querySelector('devsite-book-nav');
  const devsiteHeader = doc.querySelector('devsite-header');
  if (devsiteBookNav || devsiteHeader) {
    return 'devsite';
  }

  // Anthropic Claude Platform docs detection
  const anthropicTheme = doc.querySelector('html[data-theme="claude"]');
  const anthropicDocs = doc.querySelector('a[href*="/docs/en/"]');
  if (anthropicTheme || (anthropicDocs && doc.location?.hostname?.includes('claude.com'))) {
    return 'anthropic';
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
    case 'mintlify':
      return extractMintlifyPages(doc, baseUrl);
    case 'devsite':
      return extractDevSitePages(doc, baseUrl);
    case 'anthropic':
      return extractAnthropicPages(doc, baseUrl);
    case 'yuque':
      return extractYuquePages(doc, baseUrl);
    case 'wechat':
      return extractWechatPages(doc, baseUrl);
    case 'huawei':
      return extractHuaweiPages(doc, baseUrl);
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

// Extract Mintlify sidebar links
function extractMintlifyPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // Strategy 1: sidebar-group sections (older Mintlify)
  const sidebarGroups = doc.querySelectorAll('.sidebar-group');

  if (sidebarGroups.length > 0) {
    sidebarGroups.forEach((group) => {
      const header = group.querySelector('.sidebar-group-header');
      const section = header?.textContent?.trim();

      const links = group.querySelectorAll<HTMLAnchorElement>('a[href]');
      links.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;
        if (href.includes('mintlify-assets') || href.startsWith('http')) return;

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: 0,
          section,
        });
      });
    });
  }

  // Strategy 2: scroll-m-4 sidebar items (newer Mintlify, e.g. OpenClaw docs)
  if (pages.length === 0) {
    // Find all internal links in the left sidebar area
    // Mintlify sidebar links are in divs with class "relative scroll-m-4"
    const sidebarItems = doc.querySelectorAll('[class*="scroll-m-4"] > a[href^="/"]');

    if (sidebarItems.length > 0) {
      let currentSection = '';
      sidebarItems.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href === '/') return;

        const url = resolveUrl(href, baseUrl);
        const title = link.textContent?.trim() || url;

        pages.push({
          url,
          title,
          path: new URL(url).pathname,
          level: 0,
          section: currentSection || undefined,
        });
      });
    }

    // Also try finding section headers + their links
    if (pages.length === 0) {
      // Mintlify uses font-semibold for section headers in the sidebar
      const allSidebarLinks = doc.querySelectorAll<HTMLAnchorElement>('a[href^="/"]');
      let currentSection = '';

      allSidebarLinks.forEach((link) => {
        const href = link.getAttribute('href');
        if (!href || href === '/' || href.startsWith('#')) return;

        // Skip top nav tabs
        const parentClass = link.parentElement?.className || '';
        if (parentClass.includes('nav-tabs')) return;
        // Skip card links (they have long text with descriptions)
        if ((link.textContent?.trim() || '').length > 60) return;

        const url = resolveUrl(href, baseUrl);
        if (!isSameSite(url, baseUrl)) return;

        pages.push({
          url,
          title: link.textContent?.trim() || url,
          path: new URL(url).pathname,
          level: 0,
          section: currentSection || undefined,
        });
      });
    }
  }

  return deduplicatePages(pages);
}

// Extract Google DevSite pages (developer.chrome.com, developer.android.com, etc.)
function extractDevSitePages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // DevSite uses <devsite-book-nav> for the sidebar navigation
  const bookNav = doc.querySelector('devsite-book-nav');
  if (bookNav) {
    const links = bookNav.querySelectorAll<HTMLAnchorElement>('a[href]');
    let currentSection = '';

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const url = resolveUrl(href, baseUrl);
      if (!isSameSite(url, baseUrl)) return;

      // Detect section headers: links with devsite-nav-title class or bold/uppercase style
      const isSection = link.closest('.devsite-nav-section-header') !== null;
      if (isSection) {
        currentSection = link.textContent?.trim() || '';
      }

      // Determine level from nesting
      let level = 0;
      let parent = link.parentElement;
      while (parent && parent !== bookNav) {
        if (parent.matches('ul')) level++;
        parent = parent.parentElement;
      }

      pages.push({
        url,
        title: link.textContent?.trim() || url,
        path: new URL(url).pathname,
        level: Math.min(Math.max(level - 1, 0), 3),
        section: currentSection || undefined,
      });
    });
  }

  return deduplicatePages(pages);
}

// Extract Anthropic Claude Platform docs links
function extractAnthropicPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // Anthropic docs uses aside with links to /docs/
  const aside = doc.querySelector('aside');
  if (aside) {
    // Find section headers (font-semibold divs)
    const sections = aside.querySelectorAll('div.font-semibold');
    let currentSection = '';

    // Get all links in the aside
    const links = aside.querySelectorAll<HTMLAnchorElement>('a[href*="/docs/"]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      const url = resolveUrl(href, baseUrl);
      if (!isSameSite(url, baseUrl)) return;

      // Try to find section header before this link
      let prevSibling = link.parentElement;
      while (prevSibling) {
        const header = prevSibling.querySelector('.font-semibold');
        if (header && header.textContent) {
          currentSection = header.textContent.trim();
          break;
        }
        prevSibling = prevSibling.previousElementSibling as HTMLElement;
      }

      pages.push({
        url,
        title: link.textContent?.trim() || url,
        path: new URL(url).pathname,
        level: 0,
        section: currentSection || undefined,
      });
    });
  }

  // Fallback: get all /docs/ links from the page
  if (pages.length === 0) {
    const links = doc.querySelectorAll<HTMLAnchorElement>('a[href*="/docs/"]');
    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#')) return;

      const url = resolveUrl(href, baseUrl);
      if (!isSameSite(url, baseUrl)) return;

      pages.push({
        url,
        title: link.textContent?.trim() || url,
        path: new URL(url).pathname,
        level: 0,
      });
    });
  }

  return deduplicatePages(pages);
}

// ─── Yuque (语雀) ────────────────────────────────────────────

function extractYuquePages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // Yuque embeds TOC data in __INITIAL_STATE__ inside a script tag
  const scripts = doc.querySelectorAll('script');
  for (const script of scripts) {
    const content = script.textContent || '';

    // Find decodeURIComponent("...") pattern
    const match = content.match(/decodeURIComponent\("(.+?)"\)/);
    if (!match) continue;

    try {
      const decoded = decodeURIComponent(match[1]);
      const data = JSON.parse(decoded);

      // Extract TOC from book data
      const toc = data?.book?.toc || data?.bookDetail?.toc || [];
      if (!Array.isArray(toc) || toc.length === 0) continue;

      // Parse Yuque URL: /user/book/slug
      const urlParts = new URL(baseUrl).pathname.split('/').filter(Boolean);
      const bookBase = urlParts.length >= 2
        ? `${new URL(baseUrl).origin}/${urlParts[0]}/${urlParts[1]}`
        : baseUrl.replace(/\/$/, '');

      for (const item of toc) {
        const slug = item.url || item.slug;
        if (!slug || slug.startsWith('http')) continue;
        // Skip section headers without content
        if (item.type === 'TITLE' || item.child_uuid) continue;

        const title = item.title || slug;
        const url = `${bookBase}/${slug}`;

        pages.push({
          url,
          title,
          path: new URL(url).pathname,
          level: item.depth || 0,
          section: item.parent_uuid ? undefined : title,
        });
      }
      break;
    } catch {
      continue;
    }
  }

  // Fallback: find links in the sidebar
  if (pages.length === 0) {
    const sidebarLinks = doc.querySelectorAll<HTMLAnchorElement>(
      '.ant-tree a[href], [class*="catalog"] a[href], [class*="toc"] a[href]'
    );
    sidebarLinks.forEach((link) => {
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
  }

  return deduplicatePages(pages);
}

// ─── WeChat Developer Docs (微信开发文档) ──────────────────────

function extractWechatPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // WeChat docs have a sidebar with class "sidebar__wrp" or "sidebar"
  const sidebarSelectors = [
    '.sidebar__wrp a[href]',
    '.sidebar a[href]',
    '.book-nav a[href]',
  ];

  for (const selector of sidebarSelectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length < 3) continue;

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const url = resolveUrl(href, baseUrl);
      if (!isSameSite(url, baseUrl)) return;

      // Skip anchors within same page
      if (href.includes('#') && !href.startsWith('/')) return;

      pages.push({
        url,
        title: link.textContent?.trim() || url,
        path: new URL(url).pathname,
        level: 0,
      });
    });
    break;
  }

  return deduplicatePages(pages);
}

// ─── HarmonyOS Docs (鸿蒙开发文档) ─────────────────────────────

function extractHuaweiPages(doc: Document, baseUrl: string): DocPageItem[] {
  const pages: DocPageItem[] = [];

  // HarmonyOS docs are SPA (Angular), sidebar is JS-rendered
  // Try to find the catalog/tree links after rendering
  const sidebarSelectors = [
    '.catalog-tree a[href]',
    '.tree-node a[href]',
    '.el-tree a[href]',
    '.ant-tree a[href]',
    '[class*="catalog"] a[href]',
    '[class*="tree-node"] a[href]',
    '[class*="nav-tree"] a[href]',
    '.sidebar a[href]',
  ];

  for (const selector of sidebarSelectors) {
    const links = doc.querySelectorAll<HTMLAnchorElement>(selector);
    if (links.length < 3) continue;

    links.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

      const url = resolveUrl(href, baseUrl);
      pages.push({
        url,
        title: link.textContent?.trim() || url,
        path: new URL(url).pathname,
        level: 0,
      });
    });
    break;
  }

  // Fallback: HarmonyOS uses Angular routing, links might be relative
  if (pages.length === 0) {
    const allLinks = doc.querySelectorAll<HTMLAnchorElement>('a[href*="harmonyos"]');
    allLinks.forEach((link) => {
      const href = link.getAttribute('href');
      if (!href) return;
      const url = resolveUrl(href, baseUrl);
      pages.push({
        url,
        title: link.textContent?.trim() || url,
        path: new URL(url).pathname,
        level: 0,
      });
    });
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
  const allPages = extractPages(doc, framework, baseUrl);
  const title = doc.title || new URL(baseUrl).hostname;

  // Scope pages to the current URL's parent path
  // e.g. baseUrl = https://example.com/docs/extensions/reference/api
  //   → scopePath = /docs/extensions/reference/
  // Only include pages whose path starts with scopePath
  const baseUrlObj = new URL(baseUrl);
  const pathSegments = baseUrlObj.pathname.replace(/\/$/, '').split('/').filter(Boolean);
  // Go up one level: /a/b/c → /a/b/
  const scopePath = pathSegments.length > 1
    ? '/' + pathSegments.slice(0, -1).join('/') + '/'
    : '/';
  const pages = allPages.filter((page) => {
    try {
      const pagePath = new URL(page.url).pathname;
      return pagePath.startsWith(scopePath);
    } catch {
      return true;
    }
  });

  return {
    baseUrl,
    title,
    framework,
    pages,
  };
}
