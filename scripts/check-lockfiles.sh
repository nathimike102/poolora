#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Poolora — standalone lockfile check
# ═══════════════════════════════════════════════════════════════════════════════
# CI installs from the root workspace lockfile, but the backend Docker image and
# the Vercel projects install each package on its own from <package>/package-lock.json.
# This fails when one of those lockfiles no longer matches its package.json, so
# what CI tested and audited is what actually ships.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

failed=""
for dir in backend frontend web-landing admin-web; do
  mkdir -p "$work/$dir"
  cp "$root/$dir/package.json" "$root/$dir/package-lock.json" "$work/$dir/"
  (cd "$work/$dir" && npm install --package-lock-only --ignore-scripts --no-audit --no-fund >/dev/null)
  if ! cmp -s "$root/$dir/package-lock.json" "$work/$dir/package-lock.json"; then
    echo "::error::$dir/package-lock.json is out of sync with $dir/package.json"
    failed="$failed $dir"
  fi
done

if [ -n "$failed" ]; then
  echo "Refresh with: cp <pkg>/package*.json /tmp/x && (cd /tmp/x && npm install --package-lock-only) && cp /tmp/x/package-lock.json <pkg>/"
  exit 1
fi
echo "Standalone lockfiles match their package.json files."
