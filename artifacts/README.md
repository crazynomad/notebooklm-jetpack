# Release Artifacts

Build artifacts for Chrome Web Store submission and GitHub Releases.

| Version | File | Size | Date | Hash |
|---|---|---|---|---|
| v1.1.43 | `notebooklm-jetpack-v1.1.43.zip` | 164KB | 2025-02-24 | `0a452eb` |
| v1.1.42 | `notebooklm-jetpack-v1.1.42.zip` | 164KB | 2025-02-24 | `d0dda74` |

## How to build

```bash
pnpm release          # bump version, build, commit, push
cd dist/chrome-mv3
zip -r ../../artifacts/notebooklm-jetpack-v$(node -p "require('../../package.json').version").zip .
```
