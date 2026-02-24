# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**NotebookLM Jetpack** — a Chrome extension (Manifest V3) that imports content from multiple sources into Google NotebookLM. Supports doc sites (14+ frameworks), AI conversations (Claude/ChatGPT/Gemini), podcasts, RSS feeds, bookmarks, and plain URLs. Built with WXT framework.

GitHub: https://github.com/crazynomad/notebooklm-jetpack

## Development Commands

```bash
pnpm install     # Install dependencies
pnpm dev         # Development mode with hot reload (port 3003)
pnpm build       # Production build to dist/
pnpm zip         # Package extension for distribution
pnpm compile     # TypeScript type checking only
pnpm test        # Run unit tests (vitest)
pnpm test:watch  # Run tests in watch mode
pnpm lint        # ESLint
pnpm release     # Release script
```

After `pnpm dev`, load `dist/` as an unpacked extension in Chrome.

## Architecture

### Extension Structure (WXT Framework)
- **Background Service Worker** (`entrypoints/background.ts`): Central message hub (25+ message types). Handles import orchestration, PDF export via CDP, podcast fetching, bookmark management, doc site analysis (llms.txt → sitemap → API → DOM), and rescue/repair of failed sources.
- **Content Scripts**:
  - `entrypoints/notebooklm.content.ts`: Core DOM automation for NotebookLM page — clicks buttons, fills inputs, simulates user interactions
  - `entrypoints/claude.content.ts`: Extracts conversations from claude.ai
  - `entrypoints/chatgpt.content.ts`: Extracts conversations from chatgpt.com
  - `entrypoints/gemini.content.ts`: Extracts conversations from gemini.google.com
  - `entrypoints/docs.content.ts`: Document site analysis (dynamically injected)
- **Offscreen Document** (`entrypoints/offscreen/`): HTML→Markdown conversion via Turndown, runs in isolated DOM context since service workers lack DOM access
- **Popup UI** (`entrypoints/popup/`): React app with 5-tab layout: Docs, Podcast, AI Conversation, Bookmarks, More

### Message-Based Communication
- Popup ↔ Background via `chrome.runtime.onMessage` with typed `MessageType` union
- Background ↔ Content Scripts via message passing with `sendResponse` pattern (`{ success: boolean, data/error }`)
- Long-running processes (PDF/podcast) use `chrome.runtime.onConnect` (port-based)
- Offscreen document receives `HTML_TO_MARKDOWN` messages for DOM-dependent conversion

### Key Services
- `services/notebooklm.ts`: Tab management, content script injection, batch import with rate limiting (1.5s delays)
- `services/docs-analyzer.ts`: Framework detection for 14+ doc types (Docusaurus, MkDocs, VitePress, GitBook, ReadTheDocs, Sphinx, Mintlify, DevSite, Anthropic, Yuque, WeChat, HarmonyOS, etc.)
- `services/docs-site.ts`: AI-native doc discovery (`/llms.txt`, `/llms-full.txt`), sitemap parsing, Huawei catalog API
- `services/pdf-generator.ts`: Doc site → PDF via Chrome Debugger Protocol, concurrent page fetching (5 threads), Markdown cleanup of JSX components
- `services/podcast.ts`: Apple Podcasts (iTunes API) and 小宇宙 FM (__NEXT_DATA__ SSR extraction)
- `services/claude-conversation.ts`: AI conversation extraction wrapper (Claude/ChatGPT/Gemini)
- `services/bookmarks.ts`: Read-later system with collections, browser storage-based
- `services/rss-parser.ts`: RSS feed parsing
- `services/history.ts`: Import history storage

### DOM Automation Considerations
NotebookLM has no official API. The content script uses CSS selectors that may break when Google updates the UI. Selectors include fallbacks for both English and Chinese interfaces. Key functions to maintain:
- `findAddSourceButton()` — multiple selector attempts
- `findSubmitButton()` — dialog context aware
- `waitForElement()` — custom `:has-text()` pseudo-selector support
- `importTextToNotebookLM()` — for importing formatted text content

### Adding New Import Sources
1. Add types to `lib/types.ts` (data model + MessageType entries)
2. Add host permission to `wxt.config.ts` if needed
3. Create content script in `entrypoints/` for extraction
4. Create service in `services/` for business logic
5. Create component in `components/` for UI
6. Add message handlers in `entrypoints/background.ts`
7. Add tab/panel to `entrypoints/popup/App.tsx`

## Testing

- **Framework**: Vitest + jsdom + @testing-library/react
- **Config**: `vitest.config.ts`, setup in `tests/setup.ts` (comprehensive chrome API mocks)
- **Unit tests**: `tests/services/` and `tests/lib/`
- **PDF tests**: `tests/pdf-*.mjs` (standalone scripts for PDF generation verification)
- **E2E**: `scripts/test-e2e.mjs` (CDP-based smoke test)

## Configuration

Manifest permissions include: storage, activeTab, tabs, scripting, contextMenus, downloads, debugger, offscreen.

Host permissions: `notebooklm.google.com/*`, `claude.ai/*`, `platform.claude.com/*`.

NotebookLM config (base URL, import delay) is in `lib/config.ts`.
