# Chrome Web Store — Privacy Practices Justifications

> 逐条填入 CWS Developer Dashboard → Privacy practices tab

---

## Single Purpose Description

This extension helps users import web content (articles, documentation sites, podcasts, AI conversations, RSS feeds) into Google NotebookLM. It also allows bookmarking and aggregating multiple pages into a single PDF to optimize NotebookLM's source slots.

---

## Permission Justifications

### activeTab
Used to access the current tab's URL and page content when the user clicks the extension icon. This enables: (1) detecting if the current page is a supported platform (NotebookLM, Claude, ChatGPT, Gemini, podcast sites, doc sites), (2) extracting the current page's content for import, and (3) adding the current page to the bookmark/read-later list.

### contextMenus
Adds a right-click context menu item "Import to NotebookLM" so users can quickly import the current page or a selected link without opening the extension popup. This is a convenience shortcut for the extension's core import functionality.

### debugger
Required exclusively for the PDF export feature. The extension uses Chrome DevTools Protocol (CDP) `Page.printToPDF` command to convert aggregated HTML content into a downloadable PDF file. The flow: create a hidden blank tab → attach debugger → inject HTML → call printToPDF → detach debugger → close tab → trigger download. There is no other Chrome Extension API that supports programmatic HTML-to-PDF conversion. The debugger is only attached briefly to a controlled blank tab, never to user-browsed pages.

### downloads
Used to save generated PDF files to the user's computer. When users aggregate multiple bookmarked articles into a single PDF, or export documentation site pages as PDF, the extension uses `chrome.downloads.download()` to trigger a "Save As" dialog for the PDF file.

### host permissions (all_urls)
The extension needs to fetch content from arbitrary URLs because: (1) the bookmark/read-later feature lets users save any webpage, and the extension must later fetch those URLs to extract content for PDF aggregation; (2) batch import allows users to paste a list of any URLs for import to NotebookLM; (3) RSS feed parsing requires fetching feed URLs from any domain; (4) documentation site analysis fetches sitemap.xml and page content from any documentation site. All fetches are user-initiated — the extension never accesses URLs without explicit user action.

### offscreen
Used to run HTML-to-Markdown conversion in an offscreen document. The extension converts fetched web page HTML into clean Markdown text before importing to NotebookLM. The offscreen API provides a DOM environment (DOMParser, Turndown) for this conversion without requiring a visible tab.

### scripting
Used to inject content scripts into specific pages for content extraction: (1) NotebookLM pages — to automate the import process (click buttons, paste content, rename sources); (2) AI chat platforms (Claude, ChatGPT, Gemini) — to extract conversation Q&A pairs from the page DOM; (3) Documentation sites — to extract the sidebar navigation and page structure. Scripts are only injected into pages the user explicitly chose to interact with.

### storage
Uses `chrome.storage.local` to store: (1) bookmarked pages and collections for the read-later feature; (2) import history (last 100 entries) so users can review past imports; (3) user's language preference (Chinese/English). No personal data, credentials, or browsing history is stored. All data stays local on the user's device.

### tabs
Used to: (1) query open tabs to find the active NotebookLM tab for importing content; (2) detect the current tab's URL to identify supported platforms (AI chat sites, podcast sites, doc sites); (3) create temporary hidden tabs for PDF generation; (4) list all open tabs for the "import all tabs" batch feature. Tab access is limited to URL reading — the extension does not read tab content via this permission.

---

## Remote Code Justification

This extension does NOT use remote code. All JavaScript is bundled at build time and included in the extension package. The `chrome.debugger` + `Runtime.evaluate` usage is NOT remote code — it evaluates locally-generated strings (HTML content from user-bookmarked pages, processed via `JSON.stringify`) in a controlled blank tab for PDF rendering purposes only. No code is fetched from or executed from external servers.

---

## Data Usage Certification

- The extension does NOT collect, transmit, or share any user data
- The extension does NOT use remote code hosted externally
- All data processing happens locally in the user's browser
- No analytics, tracking, or telemetry of any kind
- No user accounts or authentication required
- Open source: https://github.com/crazynomad/notebooklm-jetpack
