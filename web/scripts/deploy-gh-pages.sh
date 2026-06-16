#!/bin/bash
# Deploy the static export to the gh-pages branch (served at pdbench.com).
# Front-end only — the launch backend lives separately (Modal).
#
#   cd web && bash scripts/deploy-gh-pages.sh
set -euo pipefail

WEB="$(cd "$(dirname "$0")/.." && pwd)"
REPO="$(cd "$WEB/.." && pwd)"
WT=/tmp/pdbench-ghp

node "$WEB/scripts/sync-fixtures.mjs"
( cd "$WEB" && NEXT_EXPORT=1 npx next build )

git -C "$REPO" worktree remove "$WT" --force 2>/dev/null || true
git -C "$REPO" worktree add -B gh-pages "$WT"
( cd "$WT" && git rm -rq . >/dev/null 2>&1 || true )
cp -a "$WEB/out/." "$WT/"
( cd "$WT" && git add -A && git commit -q -m "deploy: pd-bench platform static site" && git push -f origin gh-pages )
git -C "$REPO" worktree remove "$WT" --force

echo "deployed gh-pages -> https://pdbench.com/"
