/**
 * Regression test: ensure service-worker-bound code never uses DOM APIs directly.
 *
 * MV3 service workers have NO DOM environment (no DOMParser, document, window).
 * This test statically scans source files that run in the service worker context
 * and fails if any of them reference DOM APIs that should be delegated to the
 * offscreen document.
 *
 * Background: https://github.com/crazynomad/notebooklm-jetpack/issues/36
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Service files imported by the background service worker.
// Note: entrypoints/background.ts is excluded because it uses document.*
// inside chrome.scripting.executeScript() callbacks (which run in page context).
const SERVICE_WORKER_FILES = [
  'services/rss-parser.ts',
  'services/docs-site.ts',
  'services/notebooklm.ts',
  'services/podcast.ts',
  'services/bookmarks.ts',
  'services/history.ts',
  'services/claude-conversation.ts',
];

// DOMParser is the primary offender — it's a DOM API that absolutely
// does not exist in service workers and must be delegated to offscreen.
const FORBIDDEN_PATTERNS = [
  { pattern: /\bnew\s+DOMParser\b/, api: 'DOMParser' },
];

describe('Service worker DOM safety', () => {
  // Deduplicate file list
  const uniqueFiles = [...new Set(SERVICE_WORKER_FILES)];

  for (const relPath of uniqueFiles) {
    const fullPath = path.resolve(__dirname, '..', relPath);
    if (!fs.existsSync(fullPath)) continue;

    it(`${relPath} must not use DOM APIs directly`, () => {
      const content = fs.readFileSync(fullPath, 'utf-8');

      for (const { pattern, api } of FORBIDDEN_PATTERNS) {
        const match = content.match(pattern);
        expect(match, `Found "${api}" usage in ${relPath}. ` +
          `Service workers lack DOM APIs — delegate to the offscreen document instead.`
        ).toBeNull();
      }
    });
  }
});
