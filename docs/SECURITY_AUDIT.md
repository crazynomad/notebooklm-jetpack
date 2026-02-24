# Security Audit Report — NotebookLM Jetpack v1.1.43

**Date:** 2025-02-24
**Auditor:** Automated review (Claude)
**Commit:** `0a452eb`

---

## Executive Summary

Overall risk: **MEDIUM**. The extension has no critical vulnerabilities. The main concerns are overly broad permissions that could trigger Chrome Web Store review flags, and some `innerHTML` usage in content scripts. No data exfiltration, no eval() abuse, no credential handling issues found.

---

## Findings

### 🔴 HIGH — Overly Broad Permissions

**1. `<all_urls>` host permission**
- **File:** `wxt.config.ts` → manifest `host_permissions`
- **Issue:** `<all_urls>` grants access to all websites. Chrome Web Store reviewers flag this and may reject the submission.
- **Impact:** Users see a scary "Read and change all your data on all websites" warning during install.
- **Remediation:** Replace with specific domains actually needed:
  ```json
  "host_permissions": [
    "https://notebooklm.google.com/*",
    "https://claude.ai/*",
    "https://platform.claude.com/*",
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://gemini.google.com/*",
    "https://www.xiaoyuzhoufm.com/*",
    "https://podcasts.apple.com/*"
  ]
  ```
  For arbitrary URL imports, use `activeTab` (already granted) which gives temporary access to the current tab on user click.

**2. `debugger` permission**
- **File:** `wxt.config.ts` line 33
- **Issue:** The `debugger` permission grants Chrome DevTools Protocol access. This is extremely powerful and will almost certainly be flagged by CWS reviewers.
- **Impact:** Could theoretically be used to intercept all network traffic.
- **Remediation:** If only used for CDP-based page rendering (the `document.write` in background.ts), consider using the `offscreen` API instead, or scope usage tightly. Document the necessity for CWS review.

**3. `externally_connectable` too broad**
- **File:** `wxt.config.ts` → manifest `externally_connectable`
- **Current:** `["https://developer.chrome.com/*", "http://localhost/*", "https://*/*"]`
- **Issue:** `https://*/*` allows ANY website to send messages to the extension via `chrome.runtime.sendMessage()`. Combined with the `DEV_RELOAD` handler, any website could trigger an extension reload.
- **Remediation:** Remove `https://*/*` in production builds. Keep `http://localhost/*` for dev only.

---

### 🟡 MEDIUM — innerHTML Usage in Content Scripts

**4. Multiple `innerHTML` assignments in notebooklm.content.ts**
- **File:** `entrypoints/notebooklm.content.ts` lines 688, 838, 867, 897, 960, 1094, 1118, 1142
- **Issue:** Uses `innerHTML` to build rescue/repair banners. The values are hardcoded strings with template literals using only numeric variables (`successCount`, `failCount`), so **no user-controlled input flows into innerHTML**.
- **Risk:** LOW in practice (no injection vector), but flagged as a pattern to watch.
- **Remediation:** Consider using `createElement`/`textContent` for future-proofing, or add a comment noting values are trusted.

**5. `document.write()` via CDP**
- **File:** `entrypoints/background.ts` line 76, 87
- **Issue:** Uses `document.write(JSON.stringify(chunk))` via CDP to render pages for PDF generation.
- **Risk:** LOW — the chunk data comes from fetch responses, and `JSON.stringify` escapes the content. The target tab is an offscreen/controlled context.

---

### 🟢 LOW

**6. `onMessageExternal` DEV_RELOAD handler**
- **File:** `entrypoints/background.ts` line 155
- **Issue:** External messages can trigger `chrome.runtime.reload()`. Only responds to `type: 'DEV_RELOAD'`.
- **Risk:** LOW — only causes a reload, no data access. But should be gated behind a dev flag.
- **Remediation:** Wrap in `if (process.env.NODE_ENV === 'development')` or remove for release builds.

**7. No input validation on message handlers**
- **File:** `entrypoints/background.ts` (onMessage listener)
- **Issue:** Message handlers trust `msg.type` and `msg.url`/`msg.urls` without validation beyond basic type checks.
- **Risk:** LOW — messages come from the extension's own popup/content scripts (same origin). External messages are handled separately.
- **Remediation:** Add URL validation (already have `isValidUrl()`) on import handlers as defense-in-depth.

**8. fetch() without strict origin checks**
- **Files:** `services/rss-parser.ts`, `services/podcast.ts`, `services/docs-site.ts`, `services/pdf-generator.ts`
- **Issue:** Fetches arbitrary URLs provided by the user. No blocklist for private IPs (SSRF).
- **Risk:** LOW for a browser extension (browser's own CORS/network policies apply), but theoretically could probe `localhost` services.
- **Remediation:** Consider adding a URL blocklist for `127.0.0.1`, `localhost`, `10.*`, `192.168.*` in fetch wrappers.

---

### 📦 Dependency Vulnerabilities

**`pnpm audit` results: 5 HIGH**

| Package | Via | Issue |
|---|---|---|
| `tar` (4x) | `wxt > giget > tar` | Path traversal, arbitrary file overwrite |
| `minimatch` | `eslint > minimatch` | ReDoS |

- **Risk:** LOW — these are **dev/build dependencies only**, not shipped in the extension bundle. `tar` is used by `giget` (WXT's template downloader) and `minimatch` by ESLint. Neither runs in production.
- **Remediation:** Update when upstream releases fixes. Not a blocker for CWS submission.

---

## What's Done Well ✅

- **No eval(), no new Function()** — clean codebase
- **No sensitive data in storage** — only bookmarks, history, locale preference
- **No external analytics or tracking** — verified, no third-party SDKs
- **No credential handling** — no auth tokens, no API keys stored
- **Content scripts scoped to specific domains** — not injected everywhere
- **Manifest V3** — modern security model with service worker
- **All fetch() calls have timeouts** — no hanging requests
- **JSON.stringify used for CDP injection** — prevents script injection

---

## Recommendations for CWS Submission

| Priority | Action |
|---|---|
| 🔴 **Must** | Remove or scope `<all_urls>` — CWS will likely reject |
| 🔴 **Must** | Justify `debugger` permission or find alternative |
| 🟡 **Should** | Remove `https://*/*` from `externally_connectable` |
| 🟡 **Should** | Gate `DEV_RELOAD` handler behind dev-only flag |
| 🟢 **Nice** | Add SSRF blocklist for fetch wrappers |
| 🟢 **Nice** | Replace innerHTML with createElement in content scripts |

---

## Overall Assessment

**The extension is safe for users.** No data exfiltration, no credential theft vectors, no malicious behavior. The main risk is CWS rejection due to overly broad permissions (`<all_urls>`, `debugger`, broad `externally_connectable`). Addressing the two 🔴 items before submission is strongly recommended.
