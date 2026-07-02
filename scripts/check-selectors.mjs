#!/usr/bin/env node
/**
 * Selector canary — early-warning for when a third-party site (X/Twitter,
 * NotebookLM) reships its UI and quietly breaks our DOM selectors.
 *
 * WHAT IT CHECKS
 *   Offline (default): runs the fixture-based selector tests via vitest. These
 *   assert the registry selectors in lib/selectors.ts still extract content from
 *   frozen HTML snapshots in tests/fixtures/. This catches CODE/registry drift
 *   (someone edits a selector, or a fixture is refreshed and the logic no longer
 *   matches). Cloud/CI-safe — no network, no login.
 *
 * WHAT IT CANNOT CHECK (be honest about the limit)
 *   X renders content client-side; a headless fetch of x.com returns an empty
 *   shell with none of the `data-testid` hooks. Truly validating the selectors
 *   against LIVE X requires a logged-in real browser. Do that periodically by
 *   hand (or via the claude-in-chrome MCP in an interactive session):
 *     1. Open a public X post + a public X /article/ in your logged-in Chrome.
 *     2. In DevTools console, run for each selector in lib/selectors.ts X_SELECTORS:
 *          document.querySelectorAll('article [data-testid="tweetText"]').length
 *        Expect ≥ 1. If it's 0, X changed the testid → update lib/selectors.ts
 *        + refresh tests/fixtures/*.html, then cut a release.
 *
 * USAGE
 *   node scripts/check-selectors.mjs            # offline canary (fixtures)
 *   node scripts/check-selectors.mjs --live-reminder-days 30
 *
 * EXIT CODES
 *   0  all good
 *   1  a selector regression was detected — investigate + release
 */

import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

function log(msg) { process.stdout.write(msg + '\n'); }

log('── Selector canary ──────────────────────────────────────');

// 1. Offline fixture canary (single source of truth: lib/selectors.ts + fixtures)
let ok = true;
try {
  execFileSync('node_modules/.bin/vitest', ['run', 'tests/lib/extractors.test.ts'], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
  log('\n✅ Offline canary PASSED — registry selectors still match the fixtures.');
} catch {
  ok = false;
  log('\n❌ Offline canary FAILED — a selector no longer matches its fixture.');
  log('   → A code/registry change broke extraction. Fix lib/selectors.ts and re-run.');
}

// 2. Surface the monitored selectors so the report names exactly what to spot-check live.
try {
  const src = readFileSync(resolve(repoRoot, 'lib/selectors.ts'), 'utf-8');
  const samples = [...src.matchAll(/sample:\s*'([^']+)'/g)].map((m) => m[1]);
  if (samples.length) {
    log('\n🔎 Live spot-check (needs a logged-in browser — canary cannot do this headless):');
    for (const s of new Set(samples)) log(`   • ${s}`);
    log('   Verify each X_SELECTORS entry resolves ≥1 element; if not, update the registry + fixtures and release.');
  }
} catch { /* non-fatal */ }

// 3. Reminder cadence marker (informational; the scheduled routine reads the exit code + this text)
const stampFile = resolve(repoRoot, '.selector-check-stamp');
if (existsSync(stampFile)) {
  log(`\nℹ️  Last recorded live spot-check stamp: ${readFileSync(stampFile, 'utf-8').trim()}`);
} else {
  log('\nℹ️  No live spot-check stamp yet — do one and `echo <date> > .selector-check-stamp`.');
}

log('─────────────────────────────────────────────────────────');
process.exit(ok ? 0 : 1);
