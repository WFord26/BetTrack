#!/usr/bin/env bash
# =============================================================================
# BetTrack Docker Build Script (macOS / Linux)
#
# Builds production Docker images for backend and/or frontend and pushes them
# to GitHub Container Registry (ghcr.io).
#
# Usage:
#   ./docker-build.sh --backend --frontend [--version 2026.05.13] [--push]
#   ./docker-build.sh --backend --push --platform linux/amd64
#   ./docker-build.sh --backend --frontend --version 0.2.3 --owner myorg
#
# Flags:
#   --backend              Build backend image
#   --frontend             Build frontend image
#   --version <tag>        Override version for both images (default: each component's package.json)
#   --push                 Push to GHCR (requires GITHUB_TOKEN env var)
#   --platform <list>      Target platform(s) (default: linux/amd64,linux/arm64)
#   --owner <user>         GitHub owner (default: auto-detected from git remote)
#   --repository <name>    Repository/image prefix (default: bettrack)
#   -h|--help              Show this help
#
# Resulting image names:
#   ghcr.io/<owner>/<repository>/backend:<version>
#   ghcr.io/<owner>/<repository>/frontend:<version>
#
# Example full build + push:
#   export GITHUB_TOKEN="$(gh auth token)"   # see docs/CREDENTIALS.md
#   ./docker-build.sh --backend --frontend --version 2026.05.13 --push
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DASHBOARD_ROOT="$PROJECT_ROOT/dashboard"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
_cyan='\033[0;36m'
_green='\033[0;32m'
_yellow='\033[1;33m'
_red='\033[0;31m'
_reset='\033[0m'

log_info()  { echo -e "${_cyan}[INFO]${_reset} $*"; }
log_ok()    { echo -e "${_green}[OK]${_reset} $*"; }
log_warn()  { echo -e "${_yellow}[WARN]${_reset} $*"; }
log_error() { echo -e "${_red}[ERROR]${_reset} $*" >&2; }

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
OPT_BACKEND=0
OPT_FRONTEND=0
OPT_VERSION=""
OPT_PUSH=0
OPT_PLATFORM="linux/amd64,linux/arm64"
OPT_OWNER=""
OPT_REPOSITORY="bettrack"

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --backend)      OPT_BACKEND=1 ;;
        --frontend)     OPT_FRONTEND=1 ;;
        --version)      OPT_VERSION="$2"; shift ;;
        --push)         OPT_PUSH=1 ;;
        --platform)     OPT_PLATFORM="$2"; shift ;;
        --owner)        OPT_OWNER="$2"; shift ;;
        --repository)   OPT_REPOSITORY="$2"; shift ;;
        -h|--help)
            sed -n '/^# Usage/,/^# =====/p' "$0" | grep '^#' | sed 's/^# \?//'
            exit 0
            ;;
        *)
            log_error "Unknown flag: $1"
            exit 1
            ;;
    esac
    shift
done

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Auto-detect GitHub owner from git remote URL
detect_owner() {
    local url
    url=$(git -C "$PROJECT_ROOT" config --get remote.origin.url 2>/dev/null || true)
    if [[ "$url" =~ github\.com[:/]([^/]+)/ ]]; then
        echo "${BASH_REMATCH[1]}"
    fi
}

# Read version from package.json
get_package_version() {
    local pkg="$1"
    [[ -f "$pkg" ]] || { log_warn "package.json not found: $pkg"; return; }
    python3 -c "import json; print(json.load(open('$pkg'))['version'])" 2>/dev/null
}

# Check Docker is available
check_docker() {
    if ! command -v docker &>/dev/null; then
        log_error "Docker is not installed or not in PATH"
        exit 1
    fi
    docker info &>/dev/null || {
        log_error "Docker daemon is not running"
        exit 1
    }
    log_info "Docker $(docker --version | awk '{print $3}' | tr -d ',')"
}

# Login to GHCR using GITHUB_TOKEN
ghcr_login() {
    local owner="$1"
    if [[ -z "${GITHUB_TOKEN:-}" ]]; then
        log_error "GITHUB_TOKEN environment variable not set"
        log_info "Set with: export GITHUB_TOKEN=\"\$(gh auth token)\"  # see docs/CREDENTIALS.md"
        exit 1
    fi
    log_info "Logging into ghcr.io..."
    echo "$GITHUB_TOKEN" | docker login ghcr.io -u "$owner" --password-stdin
    log_ok "Logged into ghcr.io"
}

# Build a Docker image
build_image() {
    local name="$1"        # human label
    local context="$2"     # build context dir
    local dockerfile="$3"  # path to Dockerfile
    local local_tag="$4"   # local tag

    log_info "Building $name image..."
    log_info "  Context    : $context"
    log_info "  Dockerfile : $dockerfile"
    log_info "  Tag        : $local_tag"
    log_info "  Platform   : $OPT_PLATFORM"

    if [[ ! -f "$dockerfile" ]]; then
        log_error "$name Dockerfile not found: $dockerfile"
        return 1
    fi

    docker build \
        -f "$dockerfile" \
        -t "$local_tag" \
        --platform "$OPT_PLATFORM" \
        --label "org.opencontainers.image.source=https://github.com/WFord26/BetTrack" \
        "$context"

    log_ok "Built $name → $local_tag"
}

# Tag + push to GHCR
push_image() {
    local local_tag="$1"
    local registry="$2"   # e.g. ghcr.io/wford26
    local image_name="$3" # e.g. bettrack-backend
    local version="$4"

    local version_tag="${registry}/${image_name}:${version}"
    local latest_tag="${registry}/${image_name}:latest"

    log_info "Tagging $local_tag → $version_tag"
    docker tag "$local_tag" "$version_tag"

    log_info "Tagging $local_tag → $latest_tag"
    docker tag "$local_tag" "$latest_tag"

    log_info "Pushing $version_tag..."
    docker push "$version_tag"

    log_info "Pushing $latest_tag..."
    docker push "$latest_tag"

    log_ok "Pushed $image_name"
}

# Set a GHCR container package to public via the GitHub API.
# Package name must be the path after the owner, e.g. "bettrack/backend".
set_package_public() {
    local owner="$1"      # e.g. wford26
    local pkg_name="$2"   # e.g. bettrack/backend  (will be URL-encoded)

    # URL-encode the package name (replace / with %2F)
    local encoded_pkg="${pkg_name//\//%2F}"
    local api_url="https://api.github.com/user/packages/container/${encoded_pkg}"

    log_info "Setting ghcr.io/${owner}/${pkg_name} visibility → public..."

    local http_code
    http_code=$(curl -s -o /dev/null -w "%{http_code}" \
        -X PATCH "$api_url" \
        -H "Authorization: Bearer ${GITHUB_TOKEN}" \
        -H "Accept: application/vnd.github+json" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        -d '{"visibility":"public"}')

    if [[ "$http_code" == "200" ]]; then
        log_ok "Package ${pkg_name} is now public"
    else
        log_warn "Could not set ${pkg_name} to public (HTTP ${http_code}). Set manually: GitHub → Packages → ${pkg_name} → Package settings → Change visibility"
    fi
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    log_info "=== BetTrack Docker Build ==="

    # Validate targets
    if [[ "$OPT_BACKEND" -eq 0 && "$OPT_FRONTEND" -eq 0 ]]; then
        log_error "Must specify --backend and/or --frontend"
        exit 1
    fi

    # Resolve per-component versions.
    # If --version was explicitly provided, use it for both.
    # Otherwise read each component's own package.json.
    local backend_version="$OPT_VERSION"
    local frontend_version="$OPT_VERSION"

    if [[ "$OPT_BACKEND" -eq 1 && -z "$backend_version" ]]; then
        backend_version=$(get_package_version "$DASHBOARD_ROOT/backend/package.json")
        if [[ -z "$backend_version" ]]; then
            log_error "Could not detect backend version. Specify --version"
            exit 1
        fi
        log_info "Backend version  : $backend_version"
    fi

    if [[ "$OPT_FRONTEND" -eq 1 && -z "$frontend_version" ]]; then
        frontend_version=$(get_package_version "$DASHBOARD_ROOT/frontend/package.json")
        if [[ -z "$frontend_version" ]]; then
            log_error "Could not detect frontend version. Specify --version"
            exit 1
        fi
        log_info "Frontend version : $frontend_version"
    fi

    # Auto-detect owner
    if [[ -z "$OPT_OWNER" ]]; then
        OPT_OWNER=$(detect_owner)
        if [[ -z "$OPT_OWNER" ]]; then
            log_error "Could not auto-detect GitHub owner. Specify --owner"
            exit 1
        fi
        log_info "Detected GitHub owner: $OPT_OWNER"
    fi

    # GHCR requires lowercase registry paths
    local owner_lc
    owner_lc=$(echo "$OPT_OWNER" | tr '[:upper:]' '[:lower:]')
    local registry="ghcr.io/${owner_lc}/${OPT_REPOSITORY}"

    # Check Docker
    check_docker

    # Login if pushing
    if [[ "$OPT_PUSH" -eq 1 ]]; then
        ghcr_login "$OPT_OWNER"
    fi

    local success=1

    # ---- Backend ----
    if [[ "$OPT_BACKEND" -eq 1 ]]; then
        local backend_tag="backend:${backend_version}"
        local backend_dockerfile="$DASHBOARD_ROOT/backend/Dockerfile"

        if build_image "backend" "$DASHBOARD_ROOT" "$backend_dockerfile" "$backend_tag"; then
            if [[ "$OPT_PUSH" -eq 1 ]]; then
                push_image "$backend_tag" "$registry" "backend" "$backend_version" || success=0
                set_package_public "$owner_lc" "${OPT_REPOSITORY}/backend"
            fi
        else
            success=0
        fi
    fi

    # ---- Frontend ----
    if [[ "$OPT_FRONTEND" -eq 1 ]]; then
        local frontend_tag="frontend:${frontend_version}"
        local frontend_dockerfile="$DASHBOARD_ROOT/frontend/Dockerfile"

        if build_image "frontend" "$DASHBOARD_ROOT" "$frontend_dockerfile" "$frontend_tag"; then
            if [[ "$OPT_PUSH" -eq 1 ]]; then
                push_image "$frontend_tag" "$registry" "frontend" "$frontend_version" || success=0
                set_package_public "$owner_lc" "${OPT_REPOSITORY}/frontend"
            fi
        else
            success=0
        fi
    fi

    # ---- Summary ----
    if [[ "$success" -eq 1 ]]; then
        log_ok "=== Build Complete ==="
        if [[ "$OPT_PUSH" -eq 1 ]]; then
            log_info "Images available at:"
            [[ "$OPT_BACKEND" -eq 1 ]] && \
                log_info "  docker pull ${registry}/backend:${backend_version}"
            [[ "$OPT_FRONTEND" -eq 1 ]] && \
                log_info "  docker pull ${registry}/frontend:${frontend_version}"
        else
            log_info "Images built locally. Use --push to publish to GHCR."
        fi
    else
        log_error "=== Build Failed ==="
        exit 1
    fi
}

main
