#!/usr/bin/env bash
# Regenerate .claude/skills/* symlinks from the tracked skills in skills/.
#
# Why: the real skill content is committed under skills/ (top level), but Claude
# Code only discovers project skills under .claude/skills/. We keep .claude/ (and
# .agents/) out of git — they hold local/tool config and can leak local paths —
# so the discovery symlinks are not committed. Run this after cloning, or after
# adding a new skill, to restore them. Safe to re-run; it only (re)creates
# symlinks, never touches real content.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .claude/skills
for skill in skills/*/; do
  name="$(basename "$skill")"
  ln -sfn "../../skills/$name" ".claude/skills/$name"
  echo "linked .claude/skills/$name -> ../../skills/$name"
done
