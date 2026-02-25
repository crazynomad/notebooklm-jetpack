#!/bin/bash
# Sync docs-site/ content to the separate Mintlify docs repo (crazynomad/docs).
#
# Usage:
#   ./scripts/sync-docs.sh           # sync only
#   ./scripts/sync-docs.sh --push    # sync + commit + push
#
# The script copies .mdx files and assets (logo/, images/) from docs-site/
# to the docs repo, preserving the docs repo's own config (docs.json).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SOURCE_DIR="$(cd "$SCRIPT_DIR/../docs-site" && pwd)"
TARGET_DIR="$HOME/Github/docs"

# Verify repos exist
if [ ! -d "$SOURCE_DIR" ]; then
  echo "Error: Source directory not found: $SOURCE_DIR"
  exit 1
fi

if [ ! -d "$TARGET_DIR/.git" ]; then
  echo "Error: Target docs repo not found: $TARGET_DIR"
  echo "Clone it first: git clone https://github.com/crazynomad/docs.git ~/Github/docs"
  exit 1
fi

echo "Syncing docs-site/ → ~/Github/docs/"
echo "  Source: $SOURCE_DIR"
echo "  Target: $TARGET_DIR"
echo ""

# rsync content files, excluding config files that belong to the docs repo
rsync -av --delete \
  --exclude='.git' \
  --exclude='docs.json' \
  --exclude='mint.json' \
  --exclude='README.md' \
  --exclude='AGENTS.md' \
  --exclude='CONTRIBUTING.md' \
  --exclude='LICENSE' \
  --exclude='.gitignore' \
  --exclude='node_modules' \
  "$SOURCE_DIR/" "$TARGET_DIR/"

echo ""
echo "Sync complete."

# Show what changed in the docs repo
cd "$TARGET_DIR"
if git diff --quiet && git diff --cached --quiet && [ -z "$(git ls-files --others --exclude-standard)" ]; then
  echo "No changes detected — docs repo is already up to date."
  exit 0
fi

echo ""
echo "Changes in docs repo:"
git status --short

# If --push flag is passed, commit and push
if [ "${1:-}" = "--push" ]; then
  echo ""
  echo "Committing and pushing..."
  git add -A
  git commit -m "docs: sync from notebooklm-jetpack/docs-site"
  git push
  echo ""
  echo "Pushed to crazynomad/docs."
else
  echo ""
  echo "Run with --push to auto-commit and push, or manually:"
  echo "  cd $TARGET_DIR && git add -A && git commit -m 'docs: sync' && git push"
fi
