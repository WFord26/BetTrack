#!/usr/bin/env bash
# =============================================================================
# BetTrack Build Script (macOS / Linux)
#
# Usage:
#   ./build.sh --mcp [--version-bump patch|minor|major] [--bump-mcp] [--beta] [--release]
#   ./build.sh --dashboard [--bump-backend] [--bump-frontend]
#   ./build.sh --mcp --dashboard --version-bump minor --bump-mcp --bump-backend --bump-frontend
#   ./build.sh --full-release --version-bump patch
#   ./build.sh --full-release --version-bump minor --push-docker
#   ./build.sh --clean
#
# Flags:
#   --mcp               Build MCPB package
#   --dashboard         Build web dashboard (backend + frontend)
#   --version-bump      major | minor | patch
#   --bump-mcp          Bump mcp/manifest.json and mcp/package.json
#   --bump-dashboard    Bump dashboard/package.json
#   --bump-backend      Bump dashboard/backend/package.json
#   --bump-frontend     Bump dashboard/frontend/package.json
#   --beta              Create beta version (incremental numbering or git hash)
#   --release           Create GitHub release after MCP build
#   --full-release      Full release workflow (version bumps + builds + ZIPs + GitHub release)
#   --push-docker       Push Docker images to GHCR (requires --full-release)
#   --clean             Remove build artefacts
# =============================================================================
set -euo pipefail

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MCP_ROOT="$PROJECT_ROOT/mcp"

# ---------------------------------------------------------------------------
# Python: prefer 3.10+ (required by FastMCP); fall back to system python3
# ---------------------------------------------------------------------------
_pick_python() {
    for candidate in python3.13 python3.12 python3.11 python3.10 python3; do
        local bin; bin=$(command -v "$candidate" 2>/dev/null) || continue
        local ver; ver=$("$bin" -c "import sys; print(sys.version_info >= (3,10))" 2>/dev/null)
        [[ "$ver" == "True" ]] && echo "$bin" && return
    done
    # Last resort: system python3 (may fail pip install)
    command -v python3 2>/dev/null || { log_error "python3 not found"; exit 1; }
}
PYTHON="$(_pick_python)"
BUILD_DIR="$MCP_ROOT/build"
DIST_DIR="$MCP_ROOT/dist"
RELEASES_DIR="$MCP_ROOT/releases"
DASHBOARD_ROOT="$PROJECT_ROOT/dashboard"
DASHBOARD_BUILD_DIR="$DASHBOARD_ROOT/dist"

# ---------------------------------------------------------------------------
# Colour helpers
# ---------------------------------------------------------------------------
_cyan='\033[0;36m'
_green='\033[0;32m'
_yellow='\033[1;33m'
_red='\033[0;31m'
_reset='\033[0m'

log_info()    { echo -e "${_cyan}[INFO]${_reset} $*"; }
log_ok()      { echo -e "${_green}[OK]${_reset} $*"; }
log_warn()    { echo -e "${_yellow}[WARN]${_reset} $*"; }
log_error()   { echo -e "${_red}[ERROR]${_reset} $*" >&2; }

# ---------------------------------------------------------------------------
# Argument defaults
# ---------------------------------------------------------------------------
OPT_MCP=0
OPT_DASHBOARD=0
OPT_VERSION_BUMP=""
OPT_BUMP_MCP=0
OPT_BUMP_DASHBOARD=0
OPT_BUMP_BACKEND=0
OPT_BUMP_FRONTEND=0
OPT_BETA=0
OPT_RELEASE=0
OPT_FULL_RELEASE=0
OPT_PUSH_DOCKER=0
OPT_CLEAN=0

# ---------------------------------------------------------------------------
# Parse arguments
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
    case "$1" in
        --mcp)             OPT_MCP=1 ;;
        --dashboard)       OPT_DASHBOARD=1 ;;
        --version-bump)    OPT_VERSION_BUMP="$2"; shift ;;
        --bump-mcp)        OPT_BUMP_MCP=1 ;;
        --bump-dashboard)  OPT_BUMP_DASHBOARD=1 ;;
        --bump-backend)    OPT_BUMP_BACKEND=1 ;;
        --bump-frontend)   OPT_BUMP_FRONTEND=1 ;;
        --beta)            OPT_BETA=1 ;;
        --release)         OPT_RELEASE=1 ;;
        --full-release)    OPT_FULL_RELEASE=1 ;;
        --push-docker)     OPT_PUSH_DOCKER=1 ;;
        --clean)           OPT_CLEAN=1 ;;
        -h|--help)
            head -30 "$0" | grep '^#' | sed 's/^# \?//'
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
# Helper: read version from JSON file
# ---------------------------------------------------------------------------
get_version() {
    local file="$1"
    if [[ ! -f "$file" ]]; then
        log_warn "File not found: $file"
        echo ""
        return
    fi
    "$PYTHON" -c "import json,sys; print(json.load(open('$file'))['version'])"
}

# ---------------------------------------------------------------------------
# Helper: bump a semver string  (strips -beta.* suffix first)
# ---------------------------------------------------------------------------
bump_version() {
    local current="$1"
    local bump_type="$2"
    "$PYTHON" - "$current" "$bump_type" <<'PY'
import sys, re
ver, bump = sys.argv[1], sys.argv[2]
base = re.sub(r'-beta\.\S+$', '', ver)
m = re.match(r'^(\d+)\.(\d+)\.(\d+)$', base)
if not m:
    print(f"Invalid version: {base}", file=sys.stderr); sys.exit(1)
major, minor, patch = int(m[1]), int(m[2]), int(m[3])
if bump == 'major':  major += 1; minor = 0; patch = 0
elif bump == 'minor': minor += 1; patch = 0
elif bump == 'patch': patch += 1
print(f"{major}.{minor}.{patch}")
PY
}

# ---------------------------------------------------------------------------
# Helper: write new version into a JSON file (preserves formatting via python)
# ---------------------------------------------------------------------------
update_version() {
    local file="$1"
    local new_ver="$2"
    local label="$3"
    if [[ ! -f "$file" ]]; then
        log_warn "$label not found, skipping"
        return
    fi
    "$PYTHON" - "$file" "$new_ver" <<'PY'
import json, sys
path, ver = sys.argv[1], sys.argv[2]
with open(path) as f:
    data = json.load(f)
data['version'] = ver
with open(path, 'w') as f:
    json.dump(data, f, indent=2)
    f.write('\n')
PY
    log_ok "Updated $label to $new_ver"
}

# ---------------------------------------------------------------------------
# Helper: get short git hash (fallback: timestamp)
# ---------------------------------------------------------------------------
get_git_hash() {
    local hash
    hash=$(git -C "$PROJECT_ROOT" rev-parse --short HEAD 2>/dev/null || true)
    if [[ -n "$hash" ]]; then
        echo "$hash"
    else
        date '+%Y%m%d%H%M%S'
    fi
}

# ---------------------------------------------------------------------------
# Helper: get next incremental beta version
# ---------------------------------------------------------------------------
get_next_beta_version() {
    local base_ver="$1"
    local pattern="sports-data-mcp-v${base_ver}-beta."
    local max=0
    if [[ -d "$RELEASES_DIR" ]]; then
        for f in "$RELEASES_DIR"/${pattern}*.mcpb; do
            [[ -f "$f" ]] || continue
            n=$(basename "$f" | sed -E "s/.*-beta\.([0-9]+)\.mcpb$/\1/")
            [[ "$n" =~ ^[0-9]+$ ]] && (( n > max )) && max=$n
        done
    fi
    echo "${base_ver}-beta.$((max + 1))"
}

# ---------------------------------------------------------------------------
# Helper: calendar-based release tag (YYYY.MM.DD or YYYY.MM.DD.N)
# ---------------------------------------------------------------------------
get_calendar_version() {
    local base
    base=$(date '+%Y.%m.%d')
    local max=0
    local tags
    tags=$(git -C "$PROJECT_ROOT" tag -l "${base}*" 2>/dev/null || true)
    for tag in $tags; do
        if [[ "$tag" =~ ^${base}\.([0-9]+)$ ]]; then
            n="${BASH_REMATCH[1]}"
            (( n > max )) && max=$n
        elif [[ "$tag" == "$base" ]]; then
            (( 0 >= max )) && max=0
        fi
    done
    echo "${base}.$((max + 1))"
}

# ---------------------------------------------------------------------------
# Clean build artefacts
# ---------------------------------------------------------------------------
clean_artifacts() {
    local mcp_only="${1:-0}"
    local dash_only="${2:-0}"

    log_info "Cleaning build artefacts..."

    if [[ "$dash_only" -eq 0 ]]; then
        for d in "$BUILD_DIR" "$DIST_DIR"; do
            if [[ -d "$d" ]]; then
                rm -rf "$d"
                log_ok "Removed $d"
            fi
        done
        find "$MCP_ROOT" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find "$MCP_ROOT" -name "*.pyc" -delete 2>/dev/null || true
        log_ok "Cleaned MCP Python cache"
    fi

    if [[ "$mcp_only" -eq 0 && -d "$DASHBOARD_ROOT" ]]; then
        for d in "$DASHBOARD_BUILD_DIR" \
                 "$DASHBOARD_ROOT/backend/dist" \
                 "$DASHBOARD_ROOT/frontend/dist"; do
            if [[ -d "$d" ]]; then
                rm -rf "$d"
                log_ok "Removed $d"
            fi
        done
        log_ok "Cleaned dashboard build artefacts"
    fi
}

# ---------------------------------------------------------------------------
# Bump component versions
# ---------------------------------------------------------------------------
bump_component_versions() {
    local bump_type="$1"
    local is_beta="$2"

    # MCP
    if [[ "$OPT_BUMP_MCP" -eq 1 && "$OPT_MCP" -eq 1 ]]; then
        local manifest="$MCP_ROOT/manifest.json"
        local cur; cur=$(get_version "$manifest")
        if [[ -n "$cur" ]]; then
            log_info "MCP current version: $cur"
            local new_base; new_base=$(bump_version "$cur" "$bump_type")
            if [[ "$is_beta" -eq 1 ]]; then
                MCP_VERSION=$(get_next_beta_version "$new_base")
                log_ok "MCP new beta version: $MCP_VERSION"
            else
                MCP_VERSION="$new_base"
                log_ok "MCP new version: $MCP_VERSION"
            fi
            update_version "$manifest" "$new_base" "mcp/manifest.json"
            update_version "$MCP_ROOT/package.json" "$new_base" "mcp/package.json"
        fi
    fi

    # Dashboard root
    if [[ "$OPT_BUMP_DASHBOARD" -eq 1 && "$OPT_DASHBOARD" -eq 1 ]]; then
        local pkg="$DASHBOARD_ROOT/package.json"
        local cur; cur=$(get_version "$pkg")
        if [[ -n "$cur" ]]; then
            log_info "Dashboard current version: $cur"
            local new; new=$(bump_version "$cur" "$bump_type")
            update_version "$pkg" "$new" "dashboard/package.json"
            DASHBOARD_VERSION="$new"
        fi
    fi

    # Backend
    if [[ "$OPT_BUMP_BACKEND" -eq 1 && "$OPT_DASHBOARD" -eq 1 ]]; then
        local pkg="$DASHBOARD_ROOT/backend/package.json"
        local cur; cur=$(get_version "$pkg")
        if [[ -n "$cur" ]]; then
            log_info "Backend current version: $cur"
            local new; new=$(bump_version "$cur" "$bump_type")
            update_version "$pkg" "$new" "dashboard/backend/package.json"
            BACKEND_VERSION="$new"
        fi
    fi

    # Frontend
    if [[ "$OPT_BUMP_FRONTEND" -eq 1 && "$OPT_DASHBOARD" -eq 1 ]]; then
        local pkg="$DASHBOARD_ROOT/frontend/package.json"
        local cur; cur=$(get_version "$pkg")
        if [[ -n "$cur" ]]; then
            log_info "Frontend current version: $cur"
            local new; new=$(bump_version "$cur" "$bump_type")
            update_version "$pkg" "$new" "dashboard/frontend/package.json"
            FRONTEND_VERSION="$new"
        fi
    fi
}

# ---------------------------------------------------------------------------
# Build MCPB package
# ---------------------------------------------------------------------------
build_mcpb() {
    local version="$1"
    log_info "Building MCPB package for version $version..."

    mkdir -p "$BUILD_DIR"

    # Validate dependencies (non-fatal; packages are bundled via requirements.txt for end-users)
    log_info "Checking Python dependencies..."
    if "$PYTHON" -m pip install --dry-run -r "$MCP_ROOT/requirements.txt" -q \
           --break-system-packages 2>/dev/null; then
        log_ok "Dependencies satisfied"
    else
        log_warn "Could not verify dependencies (may be an externally-managed env) — continuing"
    fi

    # Stage files
    local pkg_dir="$BUILD_DIR/sports-data-mcp"
    rm -rf "$pkg_dir"
    mkdir -p "$pkg_dir"

    local files=(
        "sports_mcp_server.py"
        "dashboard_mcp_server.py"
        "manifest.json"
        "requirements.txt"
        "mcpb_bootstrap.py"
        "setup.py"
        "LICENSE"
        ".env.example"
        "INSTALL_INSTRUCTIONS.md"
    )
    for f in "${files[@]}"; do
        local src="$MCP_ROOT/$f"
        if [[ -f "$src" ]]; then
            cp "$src" "$pkg_dir/"
            log_info "  copied: $f"
        fi
    done

    # Copy sports_api (no __pycache__ / .pyc)
    if [[ -d "$MCP_ROOT/sports_api" ]]; then
        cp -r "$MCP_ROOT/sports_api" "$pkg_dir/sports_api"
        find "$pkg_dir/sports_api" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
        find "$pkg_dir/sports_api" -name "*.pyc" -delete 2>/dev/null || true
        log_info "  copied: sports_api/"
    fi

    # Create .mcpb (ZIP)
    mkdir -p "$RELEASES_DIR"
    local mcpb_path="$RELEASES_DIR/sports-data-mcp-v${version}.mcpb"
    rm -f "$mcpb_path"

    (cd "$pkg_dir" && zip -r -9 "$mcpb_path" . -x "*/__pycache__/*" -x "*.pyc" > /dev/null)

    local size_kb
    size_kb=$(du -k "$mcpb_path" | cut -f1)
    log_ok "MCPB package created: $mcpb_path (${size_kb} KB)"
    MCPB_PATH="$mcpb_path"
}

# ---------------------------------------------------------------------------
# Build Dashboard
# ---------------------------------------------------------------------------
build_dashboard() {
    log_info "Building Dashboard..."

    if [[ ! -d "$DASHBOARD_ROOT" ]]; then
        log_error "Dashboard directory not found: $DASHBOARD_ROOT"
        return 1
    fi

    if ! command -v node &>/dev/null; then
        log_error "Node.js not found. Install Node.js 20+ from https://nodejs.org/"
        return 1
    fi
    log_info "Using Node.js $(node --version)"

    pushd "$DASHBOARD_ROOT" > /dev/null

    if [[ ! -d "node_modules" ]]; then
        log_info "Installing dashboard dependencies..."
        npm install
    fi

    log_info "Building backend..."
    npm run build:backend
    log_ok "Backend built"

    log_info "Building frontend..."
    npm run build:frontend
    log_ok "Frontend built"

    # Assemble unified dist/
    mkdir -p "$DASHBOARD_BUILD_DIR"

    # Backend
    if [[ -d "$DASHBOARD_ROOT/backend/dist" ]]; then
        cp -r "$DASHBOARD_ROOT/backend/dist" "$DASHBOARD_BUILD_DIR/backend"
        log_ok "Copied backend build to dist/"
    fi

    # Frontend
    if [[ -d "$DASHBOARD_ROOT/frontend/dist" ]]; then
        cp -r "$DASHBOARD_ROOT/frontend/dist" "$DASHBOARD_BUILD_DIR/frontend"
        log_ok "Copied frontend build to dist/"
    fi

    # Deployment support files
    local deploy_files=(
        "package.json:$DASHBOARD_BUILD_DIR/package.json"
        "backend/package.json:$DASHBOARD_BUILD_DIR/backend/package.json"
        "backend/.env.example:$DASHBOARD_BUILD_DIR/backend/.env.example"
        "README.md:$DASHBOARD_BUILD_DIR/README.md"
        "DEPLOYMENT.md:$DASHBOARD_BUILD_DIR/DEPLOYMENT.md"
    )
    for pair in "${deploy_files[@]}"; do
        local src="${pair%%:*}"
        local dst="${pair##*:}"
        if [[ -f "$DASHBOARD_ROOT/$src" ]]; then
            mkdir -p "$(dirname "$dst")"
            cp "$DASHBOARD_ROOT/$src" "$dst"
            log_info "  copied: $src"
        fi
    done

    # Prisma schema
    if [[ -d "$DASHBOARD_ROOT/backend/prisma" ]]; then
        cp -r "$DASHBOARD_ROOT/backend/prisma" "$DASHBOARD_BUILD_DIR/backend/prisma"
        log_info "  copied: backend/prisma/"
    fi

    popd > /dev/null
    log_ok "Dashboard build complete: $DASHBOARD_BUILD_DIR"
}

# ---------------------------------------------------------------------------
# Create distribution ZIPs (backend + frontend)
# ---------------------------------------------------------------------------
create_distribution_zips() {
    local version="$1"
    ZIP_PATHS=()

    if [[ ! -d "$DASHBOARD_BUILD_DIR" ]]; then
        log_warn "Dashboard dist not found, skipping ZIPs"
        return
    fi

    mkdir -p "$RELEASES_DIR"

    for component in backend frontend; do
        local src="$DASHBOARD_BUILD_DIR/$component"
        if [[ -d "$src" ]]; then
            local zip_name="${component}.v${version}.zip"
            local zip_path="$RELEASES_DIR/$zip_name"
            rm -f "$zip_path"
            log_info "Creating $zip_name..."
            (cd "$src" && zip -r -9 "$zip_path" . > /dev/null)
            log_ok "Created: $zip_path"
            ZIP_PATHS+=("$zip_path")
        else
            log_warn "$component dist not found at $src"
        fi
    done
}

# ---------------------------------------------------------------------------
# Create GitHub release
# ---------------------------------------------------------------------------
create_github_release() {
    local version="$1"
    local package_path="$2"
    log_info "Creating GitHub release for v$version..."

    if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
        log_warn "Not a git repository, skipping release"
        return
    fi

    pushd "$PROJECT_ROOT" > /dev/null

    git add mcp/manifest.json mcp/package.json \
            dashboard/package.json \
            dashboard/backend/package.json \
            dashboard/frontend/package.json 2>/dev/null || true
    git commit -m "Release v$version" || log_warn "Nothing to commit"
    git tag -a "v$version" -m "Release version $version"
    git push origin HEAD
    git push origin "v$version"
    log_ok "Version committed and tagged"

    if command -v gh &>/dev/null; then
        gh release create "v$version" \
            --title "BetTrack v$version" \
            --notes "Release version $version" \
            "$package_path"
        log_ok "GitHub release created"
    else
        log_warn "GitHub CLI not found, skipping release creation"
        log_info "Install from: https://cli.github.com/"
    fi

    popd > /dev/null
}

# ---------------------------------------------------------------------------
# Full release workflow
# ---------------------------------------------------------------------------
full_release() {
    local bump_type="$1"

    log_info "=== Full Release Workflow ==="

    local release_tag
    release_tag=$(get_calendar_version)
    log_info "Release tag: $release_tag"

    # Step 1: Clean
    log_info "Step 1/7: Cleaning artefacts..."
    clean_artifacts 0 0

    # Step 2: Build Dashboard
    log_info "Step 2/7: Building Dashboard..."
    OPT_DASHBOARD=1
    build_dashboard

    # Step 3: Build MCP
    log_info "Step 3/7: Building MCP..."
    OPT_MCP=1
    MCP_VERSION=$(get_version "$MCP_ROOT/manifest.json")
    build_mcpb "$MCP_VERSION"

    # Step 4: Bump versions
    log_info "Step 4/7: Bumping versions..."
    MCP_VERSION="" DASHBOARD_VERSION="" BACKEND_VERSION="" FRONTEND_VERSION=""
    OPT_BUMP_MCP=1; OPT_BUMP_DASHBOARD=1; OPT_BUMP_BACKEND=1; OPT_BUMP_FRONTEND=1
    bump_component_versions "$bump_type" 0

    local dash_ver="${DASHBOARD_VERSION:-$(get_version "$DASHBOARD_ROOT/package.json")}"

    # Step 5: Distribution ZIPs
    log_info "Step 5/7: Creating distribution ZIPs..."
    create_distribution_zips "$dash_ver"

    # Step 6: Docker
    log_info "Step 6/7: Building Docker images..."
    local docker_script="$SCRIPT_DIR/docker-build.sh"
    if [[ -f "$docker_script" ]]; then
        local push_flag=""
        [[ "$OPT_PUSH_DOCKER" -eq 1 ]] && push_flag="--push"
        bash "$docker_script" --version "$release_tag" --backend --frontend $push_flag || \
            log_warn "Docker build failed, continuing..."
    else
        log_warn "docker-build.sh not found, skipping Docker builds"
    fi

    # Step 7: GitHub release
    log_info "Step 7/7: Creating GitHub release..."

    if [[ -d "$PROJECT_ROOT/.git" ]]; then
        pushd "$PROJECT_ROOT" > /dev/null

        git add .
        git commit -m "Release $release_tag

- MCP Server: v${MCP_VERSION:-?}
- Dashboard: v${dash_ver}
- Backend: v${BACKEND_VERSION:-?}
- Frontend: v${FRONTEND_VERSION:-?}" || log_warn "Nothing to commit"

        git tag -a "$release_tag" -m "Release $release_tag"
        git push origin HEAD
        git push origin "$release_tag"
        log_ok "Tagged and pushed $release_tag"

        if command -v gh &>/dev/null; then
            local all_artifacts=("$MCPB_PATH" "${ZIP_PATHS[@]}")
            local gh_args=("release" "create" "$release_tag"
                           "--title" "BetTrack Release $release_tag"
                           "--notes" "## Components
- MCP Server: v${MCP_VERSION:-?}
- Dashboard Backend: v${BACKEND_VERSION:-?}
- Dashboard Frontend: v${FRONTEND_VERSION:-?}")
            for a in "${all_artifacts[@]}"; do
                [[ -f "$a" ]] && gh_args+=("$a")
            done
            gh "${gh_args[@]}"
            log_ok "GitHub release created"
        else
            log_warn "GitHub CLI not found — install from https://cli.github.com/"
        fi

        popd > /dev/null
    fi

    log_ok "=== Full Release Complete ==="
    log_info "Release Tag : $release_tag"
    log_info "MCP Version : v${MCP_VERSION:-?}"
    log_info "Dashboard   : v${dash_ver}"
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
    log_info "=== BetTrack Build Script ==="

    # Globals set by helpers
    MCP_VERSION=""
    DASHBOARD_VERSION=""
    BACKEND_VERSION=""
    FRONTEND_VERSION=""
    MCPB_PATH=""
    ZIP_PATHS=()

    # Full release shortcut
    if [[ "$OPT_FULL_RELEASE" -eq 1 ]]; then
        if [[ -z "$OPT_VERSION_BUMP" ]]; then
            log_error "--full-release requires --version-bump"
            exit 1
        fi
        full_release "$OPT_VERSION_BUMP"
        return
    fi

    # Require at least one build target
    if [[ "$OPT_MCP" -eq 0 && "$OPT_DASHBOARD" -eq 0 && "$OPT_CLEAN" -eq 0 ]]; then
        log_warn "No build target specified. Use --mcp and/or --dashboard."
        echo ""
        echo "  Examples:"
        echo "    ./build.sh --mcp --version-bump patch --bump-mcp"
        echo "    ./build.sh --dashboard --bump-backend --bump-frontend"
        echo "    ./build.sh --mcp --dashboard --version-bump minor --bump-mcp"
        echo "    ./build.sh --full-release --version-bump patch"
        echo "    ./build.sh --clean"
        exit 0
    fi

    # Clean
    if [[ "$OPT_CLEAN" -eq 1 ]]; then
        if [[ "$OPT_MCP" -eq 1 && "$OPT_DASHBOARD" -eq 0 ]]; then
            clean_artifacts 1 0
        elif [[ "$OPT_DASHBOARD" -eq 1 && "$OPT_MCP" -eq 0 ]]; then
            clean_artifacts 0 1
        else
            clean_artifacts 0 0
        fi
        if [[ "$OPT_MCP" -eq 0 && "$OPT_DASHBOARD" -eq 0 ]]; then
            log_ok "Clean complete"
            return
        fi
    fi

    # Resolve MCP version (before any bumps)
    if [[ "$OPT_MCP" -eq 1 ]]; then
        MCP_VERSION=$(get_version "$MCP_ROOT/manifest.json")
        if [[ "$OPT_BETA" -eq 1 && -z "$OPT_VERSION_BUMP" ]]; then
            local git_hash; git_hash=$(get_git_hash)
            MCP_VERSION="${MCP_VERSION}-beta.${git_hash}"
            log_info "Using beta version: $MCP_VERSION"
        fi
    fi

    # Build dashboard first (so dist/ exists before version files are copied)
    if [[ "$OPT_DASHBOARD" -eq 1 ]]; then
        build_dashboard || {
            log_error "Dashboard build failed"
            [[ "$OPT_MCP" -eq 0 ]] && exit 1
        }
    fi

    # Bump versions if requested
    if [[ -n "$OPT_VERSION_BUMP" ]]; then
        bump_component_versions "$OPT_VERSION_BUMP" "$OPT_BETA"
        # MCP_VERSION may have been updated by bump_component_versions
    fi

    # Build MCP
    if [[ "$OPT_MCP" -eq 1 ]]; then
        if [[ -z "$MCP_VERSION" ]]; then
            MCP_VERSION=$(get_version "$MCP_ROOT/manifest.json")
        fi
        if [[ -z "$MCP_VERSION" ]]; then
            log_error "Could not determine MCP version"
            exit 1
        fi
        build_mcpb "$MCP_VERSION"
    fi

    # Copy updated package.json files into dist/ after successful builds
    if [[ -n "$OPT_VERSION_BUMP" && "$OPT_DASHBOARD" -eq 1 && -d "$DASHBOARD_BUILD_DIR" ]]; then
        [[ "$OPT_BUMP_DASHBOARD" -eq 1 ]] && \
            cp "$DASHBOARD_ROOT/package.json" "$DASHBOARD_BUILD_DIR/package.json" 2>/dev/null || true
        [[ "$OPT_BUMP_BACKEND" -eq 1 ]] && \
            cp "$DASHBOARD_ROOT/backend/package.json" "$DASHBOARD_BUILD_DIR/backend/package.json" 2>/dev/null || true
        [[ "$OPT_BUMP_FRONTEND" -eq 1 ]] && \
            cp "$DASHBOARD_ROOT/frontend/package.json" "$DASHBOARD_BUILD_DIR/frontend/package.json" 2>/dev/null || true
    fi

    # GitHub release
    if [[ "$OPT_MCP" -eq 1 && "$OPT_RELEASE" -eq 1 && "$OPT_BUMP_MCP" -eq 1 ]]; then
        if [[ "$OPT_BETA" -eq 1 ]]; then
            log_warn "Beta releases are not pushed to GitHub"
        else
            create_github_release "$MCP_VERSION" "$MCPB_PATH"
        fi
    fi

    # Summary
    log_ok "=== Build Complete ==="
    [[ -n "$MCPB_PATH" ]] && log_info "MCP Package : $MCPB_PATH"
    [[ "$OPT_DASHBOARD" -eq 1 ]] && log_info "Dashboard   : $DASHBOARD_BUILD_DIR"
}

main
