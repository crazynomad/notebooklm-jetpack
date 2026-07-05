---
name: fix-issue
description: >-
  Drive a single GitHub issue through a full confirm → reproduce → diagnose →
  fix → verify → report lifecycle, posting progress back to the issue and
  escalating if it can't be fixed. Use this whenever the user wants to work a
  specific numbered issue in this repo — e.g. "/fix-issue 57", "fix issue #42",
  "解决 issue 57", "看一下 #88 这个 bug", "帮我修 #103 并在 issue 上汇报". Trigger
  even when the user only gives an issue number and a verb like "fix"/"修"/
  "solve"/"处理", and even when they don't spell out the whole SOP — running the
  full SOP is the point of this skill.
---

# Fix a GitHub Issue (end-to-end SOP)

Work **one** issue from confirmation to a verified fix, reporting progress as
issue comments so the author can follow along, and escalating cleanly if it
resists fixing. This is the notebooklm-jetpack Chrome extension (WXT / MV3).

The issue number comes from the invocation (e.g. `/fix-issue 57` → `57`). If no
number was given, ask for one before doing anything else.

## Operating principles

- **Evidence over assertion.** Every conclusion needs proof — a test output, a
  log line, a `file:line`, a captured network response. Don't report a phase
  done on a hunch. The #57 root cause (a CDN's `Content-Disposition` header
  overriding our filename) was *only* visible at runtime, not in the diff — so
  when a bug smells like "our code looks correct but behaves wrong", reach for
  the network/console/runtime layer, not just static reading.
- **Minimal change.** Fix the reported defect, nothing else. No drive-by
  refactors. Core import-flow changes (`services/notebooklm.ts`,
  `entrypoints/notebooklm.content.ts`) must be discussed with the user before
  editing — pause and ask rather than reshaping the import pipeline.
- **Report honestly.** If you couldn't live-verify, say so. If a test failed,
  paste it. Never report success you didn't observe.
- **Don't publish without approval.** Commit locally, but do **not** `git push`,
  open a PR, or cut a release unless the user says so. The final issue comment
  asks the human to confirm.

## The workflow

Post a progress comment to the issue at the end of each phase with
`gh issue comment <N> --body-file <file>` (write the body to a scratchpad file
to keep multi-line Chinese/Markdown intact). Prefix comments with the phase
emoji so the thread reads as a timeline.

### Phase 0 — Confirm (🔍)

```bash
gh issue view <N>
gh issue view <N> --comments
```

Restate in your own words: the defect, the affected feature area, the expected
vs actual behaviour, and anything still ambiguous. Note the repro URL / inputs
the author gave. Comment: **🔍 已确认问题：<摘要>**.

### Phase 1 — Reproduce (✅ / ⚠️)

Get to a *stable* reproduction, preferring the cheapest faithful one:

- **Logic / parsing bugs** → write or adjust a failing `vitest` test that
  captures the bug, or drive the pure service function directly.
- **Network / external-dependency bugs** → reproduce at the boundary with
  `curl` (headers, redirects, response bodies). This is often faster and more
  conclusive than the UI, and it exposes root causes the UI hides. (For #57,
  `curl -sIL` on the audio URL surfaced the `Content-Disposition: ...id.m4a`
  that caused the wrong filename — no browser needed.)
- **DOM / import-flow bugs** → use `/verify` or the Chrome MCP to drive the real
  flow and observe behaviour + console.

If you **cannot** reproduce, do not guess-fix. Comment what you tried and what's
missing, `@`-mention the author for more info, and stop. Otherwise comment:
**✅ 已复现：<证据>** (or **⚠️ 无法复现：<缺口>**).

### Phase 2 — Diagnose (🩺)

Trace to the root cause, concrete to `file:line`, and explain the *mechanism* —
why it produces the symptom. Use `Explore`/`general-purpose` agents for
cross-file tracing. Distinguish "our code regressed" from "an external
dependency changed under us" — they lead to different fixes and different issue
framing. Comment: **🩺 根因：<file:line + 机制>**.

### Phase 3 — Fix (🔧, max N attempts)

Default **N = 3**. Track attempts explicitly. Each attempt:

1. Make the smallest change that addresses the root cause.
2. Run the fast gates (see **Verification commands**): type-check, then unit
   tests, then — if there's a runtime surface — drive it.
3. If it fails, comment **🔧 attempt k 失败：<现象 + 下一步假设>** and try again
   with a revised hypothesis (not the same change).

If an attempt passes, go to Phase 4. If all N attempts fail, go to **Escalate**.

### Phase 4 — Verify side-effects (🧪)

Confirm the fix works *and* broke nothing:

- Full unit suite green (not just the new test).
- Type-check clean.
- Production build succeeds and the change is actually in the bundle.
- Run `/code-review` on the diff to catch regressions the tests miss.
- State plainly what you did and did **not** verify (e.g. "code + build + unit
  verified; NOT live-verified through the download UI").

Comment: **🧪 已验证无副作用：<跑了什么>**.

### Phase 5 — Wrap up (🎉)

- Create a branch `fix/<slug>-<N>` and commit (never commit straight to `main`).
  Follow the repo's commit conventions (Co-Authored-By / Claude-Session footer).
- Per the repo's standing rule, build after the fix — don't ask.
- Comment **🎉 已修复，等待人工确认**, summarising the diff and exactly what the
  human should do to live-verify.
- Do **not** push or open a PR. Tell the user the branch name and offer to push
  + PR + release once they confirm.

### Escalate (🚨) — only if N attempts failed

Stop trying. Post a comment with everything a human needs to take over:

- Repro steps and the evidence you gathered.
- Hypotheses you **ruled out** (so nobody repeats your dead ends).
- The current most-likely direction and the concrete blocker.

Then notify the user directly in the conversation and wait for guidance. Do not
keep hammering the same approach.

## Verification commands (this repo)

`pnpm compile` / `pnpm test` / `pnpm build` can trip on a pnpm build-script
approval precheck (`ERR_PNPM_IGNORED_BUILDS`) that runs `pnpm install` first. To
run the gates directly and skip that precheck:

```bash
npx tsc --noEmit -p tsconfig.json    # type-check (WXT-generated types)
npx vitest run                       # full unit suite (jsdom + RTL)
npx wxt build                        # production build to dist/chrome-mv3/
grep -c "<your symbol>" dist/chrome-mv3/background.js   # confirm fix is bundled
```

For a real download/DOM/import check, prefer the `/verify` skill or the
`claude-in-chrome` MCP over asserting from tests alone.

## Where things live (fast map)

- `entrypoints/background.ts` — central message hub + all `chrome.downloads`,
  CDP/PDF, podcast, doc-analysis orchestration.
- `entrypoints/*.content.ts` — per-site content scripts (notebooklm, claude,
  chatgpt, gemini, docs).
- `services/` — business logic (podcast, docs-site, pdf-generator, youtube,
  rss-parser, bookmarks, history, notebook-api). Most unit-tested.
- `lib/selectors.ts` — fragile DOM selectors, centralized + fixture-tested.
- `tests/services/`, `tests/lib/` — vitest specs.

## Anti-goals

- Don't turn a bug fix into a refactor.
- Don't fix multiple issues in one branch.
- Don't silently widen scope; if the real fix is bigger than the report, say so
  and ask.
- Don't mark an issue resolved or close it — the human confirms and closes.
