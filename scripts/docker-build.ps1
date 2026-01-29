<#
.SYNOPSIS
    Build and push Docker images for BetTrack to GitHub Container Registry

.DESCRIPTION
    Builds production Docker images for backend and frontend, tags them with
    version and latest, and pushes to GitHub Container Registry (ghcr.io).

.PARAMETER Version
    Version tag for the images (e.g., "2026.01.12" or "0.2.3"). If not specified, will auto-detect from package.json files.

.PARAMETER Backend
    Build and push backend image

.PARAMETER Frontend
    Build and push frontend image

.PARAMETER Push
    Push images to registry (requires GITHUB_TOKEN)

.PARAMETER Platform
    Target platform(s) for multi-arch builds (default: linux/amd64,linux/arm64)

.PARAMETER Owner
    GitHub repository owner (default: auto-detected from git)

.PARAMETER Repository
    Repository name (default: bettrack)

.EXAMPLE
    .\docker-build.ps1 -Version "2026.01.12" -Backend -Frontend -Push

.EXAMPLE
    .\docker-build.ps1 -Version "0.2.3" -Backend -Push -Platform "linux/amd64"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory=$false)]
    [string]$Version,
    
    [Parameter()]
    [switch]$Backend,
    
    [Parameter()]
    [switch]$Frontend,
    
    [Parameter()]
    [switch]$Push,
    
    [Parameter()]
    [string]$Platform = "linux/amd64,linux/arm64",
    
    [Parameter()]
    [string]$Owner,
    
    [Parameter()]
    [string]$Repository = "bettrack"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot  # Root of BetTrack
$DashboardRoot = Join-Path $ProjectRoot "dashboard"

# Colors for output
function Write-ColorOutput {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Message,
        [Parameter()]
        [ValidateSet('Info', 'Success', 'Warning', 'Error')]
        [string]$Type = 'Info'
    )
    
    $color = switch ($Type) {
        'Info'    { 'Cyan' }
        'Success' { 'Green' }
        'Warning' { 'Yellow' }
        'Error'   { 'Red' }
    }
    
    $prefix = switch ($Type) {
        'Info'    { '[INFO]' }
        'Success' { '[OK]' }
        'Warning' { '[WARN]' }
        'Error'   { '[ERROR]' }
    }
    
    Write-Host "$prefix $Message" -ForegroundColor $color
}

# Get GitHub owner from git remote
function Get-GitHubOwner {
    try {
        $remoteUrl = git -C $DashboardRoot config --get remote.origin.url 2>$null
        if ($remoteUrl -match 'github\.com[:/]([^/]+)/') {
            return $matches[1]
        }
    } catch {
        # Ignore errors
    }
    return $null
}

# Get version from package.json
function Get-PackageVersion {
    param(
        [Parameter(Mandatory=$true)]
        [string]$PackageJsonPath
    )
    
    if (-not (Test-Path $PackageJsonPath)) {
        Write-ColorOutput "package.json not found at: $PackageJsonPath" -Type Warning
        return $null
    }
    
    try {
        $packageJson = Get-Content $PackageJsonPath -Raw | ConvertFrom-Json
        return $packageJson.version
    } catch {
        Write-ColorOutput "Failed to read version from $PackageJsonPath : $_" -Type Error
        return $null
    }
}

# Check if Docker is available
function Test-DockerAvailable {
    try {
        docker --version | Out-Null
        return $true
    } catch {
        Write-ColorOutput "Docker is not installed or not in PATH" -Type Error
        return $false
    }
}

# Check if logged into GitHub Container Registry
function Test-GHCRLogin {
    if (-not $env:GITHUB_TOKEN) {
        Write-ColorOutput "GITHUB_TOKEN environment variable not set" -Type Warning
        Write-ColorOutput "Set with: `$env:GITHUB_TOKEN = 'your_pat_token'" -Type Info
        return $false
    }
    return $true
}

# Login to GitHub Container Registry
function Connect-GHCR {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Owner
    )
    
    if (-not (Test-GHCRLogin)) {
        return $false
    }
    
    try {
        Write-ColorOutput "Logging into ghcr.io..." -Type Info
        $env:GITHUB_TOKEN | docker login ghcr.io -u $Owner --password-stdin 2>&1 | Out-Null
        Write-ColorOutput "Successfully logged into ghcr.io" -Type Success
        return $true
    } catch {
        Write-ColorOutput "Failed to login to ghcr.io: $_" -Type Error
        return $false
    }
}

# Build Docker image
function Build-DockerImage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Name,
        [Parameter(Mandatory=$true)]
        [string]$Context,
        [Parameter(Mandatory=$true)]
        [string]$Dockerfile,
        [Parameter(Mandatory=$true)]
        [string]$Tag
    )
    
    Write-ColorOutput "Building ${Name} image..." -Type Info
    Write-ColorOutput "Context: $Context" -Type Info
    Write-ColorOutput "Tag: $Tag" -Type Info
    
    try {
        docker build `
            -f $Dockerfile `
            -t $Tag `
            --platform $Platform `
            $Context
        
        if ($LASTEXITCODE -ne 0) {
            throw "Docker build failed with exit code $LASTEXITCODE"
        }
        
        Write-ColorOutput "Successfully built ${Name}" -Type Success
        return $true
    } catch {
        Write-ColorOutput "Failed to build ${Name}: $_" -Type Error
        return $false
    }
}

# Tag and push Docker image
function Publish-DockerImage {
    param(
        [Parameter(Mandatory=$true)]
        [string]$LocalTag,
        [Parameter(Mandatory=$true)]
        [string]$RemoteRegistry,
        [Parameter(Mandatory=$true)]
        [string]$ImageName,
        [Parameter(Mandatory=$true)]
        [string]$Version
    )
    
    $versionTag = "${RemoteRegistry}/${ImageName}:${Version}"
    $latestTag = "${RemoteRegistry}/${ImageName}:latest"
    
    Write-ColorOutput "Tagging image with version and latest..." -Type Info
    
    try {
        # Tag with version
        docker tag $LocalTag $versionTag
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to tag with version"
        }
        
        # Tag with latest
        docker tag $LocalTag $latestTag
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to tag with latest"
        }
        
        Write-ColorOutput "Pushing $versionTag..." -Type Info
        docker push $versionTag
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to push version tag"
        }
        
        Write-ColorOutput "Pushing $latestTag..." -Type Info
        docker push $latestTag
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to push latest tag"
        }
        
        Write-ColorOutput "Successfully pushed $ImageName" -Type Success
        return $true
    } catch {
        Write-ColorOutput "Failed to publish image: $_" -Type Error
        return $false
    }
}

# Main execution
function Main {
    Write-ColorOutput "=== BetTrack Docker Build ===" -Type Info

# Auto-detect version if not provided
if (-not $Version) {
    Write-ColorOutput "Version not specified, auto-detecting from package.json..." -Type Info
    
    if ($Backend) {
        $backendPackage = Join-Path $DashboardRoot "backend/package.json"
        $Version = Get-PackageVersion -PackageJsonPath $backendPackage
        if ($Version) {
            Write-ColorOutput "Using backend version: $Version" -Type Info
        }
    }
    
    if (-not $Version -and $Frontend) {
        $frontendPackage = Join-Path $DashboardRoot "frontend/package.json"
        $Version = Get-PackageVersion -PackageJsonPath $frontendPackage
        if ($Version) {
            Write-ColorOutput "Using frontend version: $Version" -Type Info
        }
    }
    
    if (-not $Version) {
        Write-ColorOutput "Could not auto-detect version. Please specify -Version parameter" -Type Error
        exit 1
    }
}

    
    # Validate inputs
    if (-not $Backend -and -not $Frontend) {
        Write-ColorOutput "Must specify -Backend and/or -Frontend" -Type Error
        exit 1
    }
    
    # Check Docker
    if (-not (Test-DockerAvailable)) {
        exit 1
    }
    
    # Auto-detect owner if not provided
    if (-not $Owner) {
        $Owner = Get-GitHubOwner
        if (-not $Owner) {
            Write-ColorOutput "Could not auto-detect GitHub owner. Please specify -Owner parameter" -Type Error
            exit 1
        }
        Write-ColorOutput "Detected GitHub owner: $Owner" -Type Info
    }
    
    $registry = "ghcr.io/$Owner"
    
    # Login if pushing
    if ($Push) {
        if (-not (Connect-GHCR -Owner $Owner)) {
            Write-ColorOutput "Cannot push without GHCR authentication" -Type Error
            exit 1
        }
    }
    
    $success = $true
    
    # Build backend
    if ($Backend) {
        # Use dashboard root as context for workspace support
        $backendContext = $DashboardRoot
        $backendDockerfile = Join-Path $DashboardRoot "backend\Dockerfile"
        $backendTag = "bettrack-backend:$Version"
        
        if (-not (Test-Path $backendDockerfile)) {
            Write-ColorOutput "Backend Dockerfile not found at $backendDockerfile" -Type Error
            $success = $false
        } else {
            if (Build-DockerImage -Name "backend" -Context $backendContext -Dockerfile $backendDockerfile -Tag $backendTag) {
                if ($Push) {
                    if (-not (Publish-DockerImage -LocalTag $backendTag -RemoteRegistry $registry -ImageName "$Repository-backend" -Version $Version)) {
                        $success = $false
                    }
                }
            } else {
                $success = $false
            }
        }
    }
    
    # Build frontend
    if ($Frontend) {
        # Use dashboard root as context for workspace support
        $frontendContext = $DashboardRoot
        $frontendDockerfile = Join-Path $DashboardRoot "frontend\Dockerfile"
        $frontendTag = "bettrack-frontend:$Version"
        
        if (-not (Test-Path $frontendDockerfile)) {
            Write-ColorOutput "Frontend Dockerfile not found at $frontendDockerfile" -Type Error
            $success = $false
        } else {
            if (Build-DockerImage -Name "frontend" -Context $frontendContext -Dockerfile $frontendDockerfile -Tag $frontendTag) {
                if ($Push) {
                    if (-not (Publish-DockerImage -LocalTag $frontendTag -RemoteRegistry $registry -ImageName "$Repository-frontend" -Version $Version)) {
                        $success = $false
                    }
                }
            } else {
                $success = $false
            }
        }
    }
    
    # Summary
    Write-ColorOutput "=== Build Complete ===" -Type $(if ($success) { 'Success' } else { 'Error' })
    
    if ($Push -and $success) {
        Write-ColorOutput "Images available at:" -Type Info
        if ($Backend) {
            Write-ColorOutput "  docker pull $registry/${Repository}-backend:$Version" -Type Info
            Write-ColorOutput "  docker pull $registry/${Repository}-backend:latest" -Type Info
        }
        if ($Frontend) {
            Write-ColorOutput "  docker pull $registry/${Repository}-frontend:$Version" -Type Info
            Write-ColorOutput "  docker pull $registry/${Repository}-frontend:latest" -Type Info
        }
    } elseif (-not $Push -and $success) {
        Write-ColorOutput "Images built locally. Use -Push to publish to registry" -Type Info
    }
    
    if (-not $success) {
        exit 1
    }
}

# Run main
Main
