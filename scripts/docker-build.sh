#!/usr/bin/env bash
# =============================================================================
# BetTrack Docker Build — shim
#
# The implementation now lives in scripts/docker-build.mjs, so macOS, Linux and
# Windows share one codebase instead of three. This wrapper stays so existing
# invocations and muscle memory keep working; every flag is forwarded as-is,
# including the old --backend / --frontend / --all spellings.
#
#   ./docker-build.sh --backend --frontend --push
#   ./docker-build.sh all --push --latest
#   node scripts/docker-build.mjs --help
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
    echo "[ERROR] Node.js is required (>= 22). Install it, then re-run." >&2
    exit 1
fi

exec node "$SCRIPT_DIR/docker-build.mjs" "$@"
