# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that imports web pages, YouTube videos, playlists, and RSS feeds into Google NotebookLM. Requires YouTube channel subscription verification to unlock functionality.

## Development Commands

```bash
pnpm install     # Install dependencies
pnpm dev         # Development mode with hot reload (port 3003)
pnpm build       # Production build to dist/
pnpm zip         # Package extension for distribution
pnpm compile     # TypeScript type checking only
pnpm lint        # ESLint check
pnpm lint:fix    # ESLint auto-fix
```

After `pnpm dev`, load `dist/` as an unpacked extension in Chrome.

## Architecture

### Extension Structure (WXT Framework)
- **Background Service Worker** (`entrypoints/background.ts`): Message hub handling all cross-component communication via `chrome.runtime.onMessage`
- **Content Script** (`entrypoints/notebooklm.content.ts`): DOM automation for NotebookLM page - clicks buttons, fills inputs, simulates user interactions
- **Popup UI** (`entrypoints/popup/`): React app with tabbed interface for different import modes

### Message-Based Communication
Popup → Background → Content Script flow using typed messages defined in `lib/types.ts`. All async operations return through `sendResponse` pattern with `{ success: boolean, data/error }` shape.

### Key Services
- `services/youtube-api.ts`: OAuth2 subscription verification, playlist fetching via YouTube Data API v3
- `services/rss-parser.ts`: RSS feed parsing
- `services/notebooklm.ts`: Tab management, content script injection, batch import orchestration with rate limiting (1.5s delays)

### DOM Automation Considerations
NotebookLM has no official API. The content script uses CSS selectors that may break when Google updates the UI. Selectors include fallbacks for both English and Chinese interfaces. Key functions to maintain:
- `findAddSourceButton()` - multiple selector attempts
- `findSubmitButton()` - dialog context aware
- `waitForElement()` - custom `:has-text()` pseudo-selector support

## Configuration

Before use, configure OAuth2 in `wxt.config.ts`:
```typescript
oauth2: {
  client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
}
```

Channel ID for subscription verification is in `lib/config.ts`.
