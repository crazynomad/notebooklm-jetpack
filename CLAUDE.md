# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A Chrome extension (Manifest V3) that imports web pages, YouTube videos, playlists, RSS feeds, and Claude conversations into Google NotebookLM. Requires YouTube channel subscription verification to unlock functionality.

## Development Commands

```bash
pnpm install     # Install dependencies
pnpm dev         # Development mode with hot reload (port 3003)
pnpm build       # Production build to dist/
pnpm zip         # Package extension for distribution
pnpm compile     # TypeScript type checking only
```

After `pnpm dev`, load `dist/` as an unpacked extension in Chrome.

## Architecture

### Extension Structure (WXT Framework)
- **Background Service Worker** (`entrypoints/background.ts`): Message hub handling all cross-component communication via `chrome.runtime.onMessage`
- **Content Scripts**:
  - `entrypoints/notebooklm.content.ts`: DOM automation for NotebookLM page - clicks buttons, fills inputs, simulates user interactions
  - `entrypoints/claude.content.ts`: Extracts conversations from claude.ai pages
  - `entrypoints/docs.content.ts`: Analyzes document site structures (dynamically injected)
- **Popup UI** (`entrypoints/popup/`): React app with tabbed interface for different import modes

### Message-Based Communication
Popup → Background → Content Script flow using typed messages defined in `lib/types.ts`. All async operations return through `sendResponse` pattern with `{ success: boolean, data/error }` shape.

### Key Services
- `services/youtube-api.ts`: OAuth2 subscription verification, playlist fetching via YouTube Data API v3
- `services/rss-parser.ts`: RSS feed parsing
- `services/notebooklm.ts`: Tab management, content script injection, batch import orchestration with rate limiting (1.5s delays)
- `services/claude-conversation.ts`: Extract and format Claude conversations for import
- `services/docs-analyzer.ts`: Document framework detection (Docusaurus, MkDocs, VitePress, GitBook, Mintlify, Anthropic, etc.)
- `services/history.ts`: Import history storage

### DOM Automation Considerations
NotebookLM has no official API. The content script uses CSS selectors that may break when Google updates the UI. Selectors include fallbacks for both English and Chinese interfaces. Key functions to maintain:
- `findAddSourceButton()` - multiple selector attempts
- `findSubmitButton()` - dialog context aware
- `waitForElement()` - custom `:has-text()` pseudo-selector support
- `importTextToNotebookLM()` - for importing formatted text content

### Adding New Import Sources
To add a new import source (like Claude conversations):
1. Add types to `lib/types.ts` (data model + MessageType entries)
2. Add host permission to `wxt.config.ts` if needed
3. Create content script in `entrypoints/` for extraction
4. Create service in `services/` for business logic
5. Create component in `components/` for UI
6. Add message handlers in `entrypoints/background.ts`
7. Add tab to `entrypoints/popup/App.tsx`

## Configuration

Before use, configure OAuth2 in `wxt.config.ts`:
```typescript
oauth2: {
  client_id: 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
}
```

Channel ID for subscription verification is in `lib/config.ts`.
