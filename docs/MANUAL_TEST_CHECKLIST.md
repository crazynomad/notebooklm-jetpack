# Pre-Release Manual Test Checklist

> Unit tests run in jsdom, which **masks** the real Chrome extension runtime.
> The following features depend on live Chrome APIs, external services, or third-party DOM structures that can break without any code change on our side.

---

## P0 — Must Pass (core flow, high fragility)

These break silently and affect all users. **Block release if any fail.**

### NotebookLM DOM Automation
_Google can update the UI at any time. Selectors may silently break._

- [ ] Import a URL → "Add source" dialog opens, URL fills, "Insert" clicks
- [ ] Import text → "Copied text" tab, content fills, optional title works
- [ ] Test with both **English** and **Chinese** NotebookLM UI
- [ ] Failed sources: open a notebook with errored sources → Rescue banner appears → scan + rescue works

### Offscreen Document (just fixed in v1.5.3)
- [ ] RSS feed: paste `http://www.aaronsw.com/2002/feeds/pgessays.rss` → items load
- [ ] RSS feed: paste an Atom feed → items load
- [ ] Doc site with sitemap: analyze a Docusaurus/MkDocs site → pages discovered via sitemap.xml
- [ ] PDF export: select pages from a doc site → PDF downloads correctly

---

## P1 — Should Pass (external API / DOM dependency)

These depend on third-party services. **Investigate failures before release.**

### AI Conversation Extraction
- [ ] **Claude**: open a conversation on claude.ai → extract → Q&A pairs shown → import to NotebookLM
- [ ] **ChatGPT**: open a conversation on chatgpt.com → extract → Q&A pairs shown
- [ ] **Gemini**: open a conversation on gemini.google.com → extract → Q&A pairs shown

### Podcast
- [ ] **Apple Podcasts**: paste a podcast URL → episodes list loads with titles/durations
- [ ] **小宇宙**: paste a 小宇宙 podcast URL → episodes load
- [ ] Download 2-3 episodes → files saved to correct folder structure

### Doc Site Analysis
- [ ] **llms.txt site** (e.g., React docs) → pages discovered via /llms.txt
- [ ] **Sitemap site** (e.g., a Docusaurus site) → pages discovered via sitemap.xml
- [ ] **HarmonyOS** → pages discovered via Huawei catalog API

---

## P2 — Smoke Test (stable, lower risk)

These are backed by unit tests but worth a quick manual check.

### Bookmarks
- [ ] Add bookmark → appears in list → persists after extension reload
- [ ] Create collection → move bookmark to it → remove bookmark

### Popup UI
- [ ] Tab auto-detection: open popup from podcast URL → auto-switch to Podcast tab
- [ ] Tab auto-detection: open popup from claude.ai → auto-switch to AI tab
- [ ] Language toggle (EN ↔ 中) → all text switches → persists after reload
- [ ] Import history: click history icon → recent imports shown → clear works

### Context Menu
- [ ] Right-click on page → "导入此页面到 NotebookLM" → imports
- [ ] Right-click on link → "导入此链接到 NotebookLM" → imports

### Batch Import
- [ ] Import 5+ URLs → progress shows completed/total → all succeed

---

## Quick Regression Checks (< 5 min)

Run these as a **minimum** before any release:

```
1. npx vitest run                    # unit tests pass
2. npx tsc --noEmit                  # type check passes
3. pnpm build                        # production build succeeds
4. Load dist/ in Chrome              # extension loads without errors
5. Open popup                        # popup renders, no blank screen
6. Import one URL to NotebookLM      # core flow works end-to-end
7. Parse one RSS feed                # offscreen XML parsing works
```

---

## What Can Break Without Code Changes

| Risk | Source | Symptom |
|------|--------|---------|
| **High** | Google updates NotebookLM UI | CSS selectors fail, import hangs |
| **High** | Claude/ChatGPT/Gemini DOM changes | Conversation extraction returns empty |
| **Medium** | iTunes API changes | Podcast fetch returns 0 episodes |
| **Medium** | Doc sites remove sitemap/llms.txt | Page discovery returns empty |
| **Low** | Chrome API deprecation | Extension fails to load |

---

## Test Environment Requirements

- Chrome browser (latest stable)
- Live internet connection
- NotebookLM account (https://notebooklm.google.com)
- At least one conversation on claude.ai / chatgpt.com / gemini.google.com
- A real RSS feed URL
- A real Apple Podcasts URL
