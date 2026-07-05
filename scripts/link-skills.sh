#!/usr/bin/env bash
# Regenerate .claude/skills/* symlinks from the tracked skills in .agents/skills/.
#
# Why: the real skill content is committed under .agents/skills/, but Claude Code
# only discovers project skills under .claude/skills/. We keep .claude/ out of git
# (it holds local config and can leak local paths), so the discovery symlinks are
# not committed — run this after cloning, or after adding a new skill, to restore
# them. Safe to re-run; it only (re)creates symlinks, never touches real content.
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p .claude/skills
for skill in .agents/skills/*/; do
  name="$(basename "$skill")"
  ln -sfn "../../.agents/skills/$name" ".claude/skills/$name"
  echo "linked .claude/skills/$name -> ../../.agents/skills/$name"
done
