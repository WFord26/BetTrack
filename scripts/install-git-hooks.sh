#!/usr/bin/env bash
# Point this repository's git hooks at scripts/hooks so they are version controlled.
# Run once per clone: ./scripts/install-git-hooks.sh
set -euo pipefail
cd "$(dirname "$0")/.."
chmod +x scripts/hooks/* 2>/dev/null || true
git config core.hooksPath scripts/hooks
echo "core.hooksPath set to scripts/hooks"
echo "Installed hooks:"
ls -1 scripts/hooks
if ! command -v gitleaks >/dev/null 2>&1; then
  echo
  echo "Optional: install gitleaks for a deeper local scan."
  echo "  macOS: brew install gitleaks"
  echo "  Windows: winget install gitleaks.gitleaks"
fi
