<#
.SYNOPSIS
    Build script for Sports Data MCP package and Dashboard

.DESCRIPTION
    Creates MCPB (MCP Bundle) package for Claude Desktop installation and/or
    builds the web dashboard (React + Node.js). Handles versioning, packaging,
    Docker builds, and GitHub releases.

.PARAMETER VersionBump
    Type of version bump: major, minor, or patch

.PARAMETER BumpMCP
    Bump MCP server version (manifest.json and mcp/package.json)

.PARAMETER BumpDashboard
    Bump Dashboard root version (dashboard/package.json)

.PARAMETER BumpBackend
    Bump Dashboard backend version (dashboard/backend/package.json)

.PARAMETER BumpFrontend
    Bump Dashboard frontend version (dashboard/frontend/package.json)

.PARAMETER MCP
    Build the MCP server package (MCPB)

.PARAMETER Dashboard
    Build the web dashboard (backend + frontend)

.PARAMETER Beta
    Create beta version with incremental numbering or git hash

.PARAMETER Release
    Create GitHub release after successful build (MCP only)

.PARAMETER FullRelease
    Complete release workflow: version bumps, builds, ZIPs, Docker images, GitHub release

.PARAMETER PushDocker
    Push Docker images to GitHub Container Registry (requires GITHUB_TOKEN)

.PARAMETER Clean
    Clean build artifacts before building

.EXAMPLE
    .\build.ps1 -MCP -VersionBump patch -BumpMCP
    .\build.ps1 -Dashboard -VersionBump patch -BumpBackend
    .\build.ps1 -MCP -Dashboard -VersionBump minor -BumpMCP -BumpDashboard -BumpBackend -BumpFrontend
    .\build.ps1 -FullRelease -VersionBump patch
    .\build.ps1 -FullRelease -VersionBump minor -PushDocker
    .\build.ps1 -Clean
#>

[CmdletBinding()]
param(
    [Parameter()]
    [ValidateSet('major', 'minor', 'patch')]
    [string]$VersionBump,
    
    [Parameter()]
    [switch]$BumpMCP,
    
    [Parameter()]
    [switch]$BumpDashboard,
    
    [Parameter()]
    [switch]$BumpBackend,
    
    [Parameter()]
    [switch]$BumpFrontend,
    
    [Parameter()]
    [switch]$MCP,
    
    [Parameter()]
    [switch]$Dashboard,
    
    [Parameter()]
    [switch]$Beta,
    
    [Parameter()]
    [switch]$Release,
    
    [Parameter()]
    [switch]$FullRelease,
    
    [Parameter()]
    [switch]$PushDocker,
    
    [Parameter()]
    [switch]$Clean
)

# Script configuration
$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot  # Root of Sports-Odds-MCP
$MCPRoot = Join-Path $ProjectRoot "mcp"
$BuildDir = Join-Path $MCPRoot "build"
$DistDir = Join-Path $MCPRoot "dist"
$ReleasesDir = Join-Path $MCPRoot "releases"
$DashboardRoot = Join-Path $ProjectRoot "dashboard"
$DashboardBuildDir = Join-Path $DashboardRoot "dist"

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

# Clean build artifacts
function Clean-BuildArtifacts {
    param(
        [switch]$MCPOnly,
        [switch]$DashboardOnly
    )
    
    Write-ColorOutput "Cleaning build artifacts..." -Type Info
    
    if (-not $DashboardOnly) {
        # Clean MCP build artifacts
        $dirsToClean = @($BuildDir, $DistDir)
        foreach ($dir in $dirsToClean) {
            if (Test-Path $dir) {
                Remove-Item -Path $dir -Recurse -Force
                Write-ColorOutput "Removed $dir" -Type Success
            }
        }
        
        # Clean Python cache
        Get-ChildItem -Path $ScriptRoot -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
        Get-ChildItem -Path $ScriptRoot -Recurse -Filter "*.pyc" | Remove-Item -Force
        Write-ColorOutput "Cleaned MCP Python cache files" -Type Success
    }
    
    if (-not $MCPOnly -and (Test-Path $DashboardRoot)) {
        # Clean Dashboard build artifacts
        if (Test-Path $DashboardBuildDir) {
            Remove-Item -Path $DashboardBuildDir -Recurse -Force
            Write-ColorOutput "Removed dashboard dist directory" -Type Success
        }
        
        # Clean backend dist
        $backendDist = Join-Path $DashboardRoot "backend\dist"
        if (Test-Path $backendDist) {
            Remove-Item -Path $backendDist -Recurse -Force
            Write-ColorOutput "Removed backend dist directory" -Type Success
        }
        
        # Clean frontend dist
        $frontendDist = Join-Path $DashboardRoot "frontend\dist"
        if (Test-Path $frontendDist) {
            Remove-Item -Path $frontendDist -Recurse -Force
            Write-ColorOutput "Removed frontend dist directory" -Type Success
        }
        
        # Clean node_modules if requested (optional)
        # Uncomment if you want to clean node_modules as well
        # Get-ChildItem -Path $DashboardRoot -Recurse -Directory -Filter "node_modules" | Remove-Item -Recurse -Force
        
        Write-ColorOutput "Cleaned Dashboard build artifacts" -Type Success
    }
}

# Read version from a specific file
function Get-VersionFromFile {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath,
        [Parameter(Mandatory=$true)]
        [string]$FileType  # 'manifest' or 'package'
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-ColorOutput "$FileType not found at $FilePath" -Type Warning
        return $null
    }
    
    $content = Get-Content $FilePath -Raw | ConvertFrom-Json
    return $content.version
}

# Bump a version number
function Get-BumpedVersion {
    param(
        [Parameter(Mandatory=$true)]
        [string]$CurrentVersion,
        [Parameter(Mandatory=$true)]
        [string]$BumpType
    )
    
    # Parse version (strip beta suffix if present)
    $baseVersion = $CurrentVersion -replace '-beta\.\d+$', '' -replace '-beta\.[a-f0-9]+$', ''
    
    if ($baseVersion -match '^(\d+)\.(\d+)\.(\d+)$') {
        $major = [int]$matches[1]
        $minor = [int]$matches[2]
        $patch = [int]$matches[3]
    } else {
        Write-ColorOutput "Invalid version format: $baseVersion" -Type Error
        return $null
    }
    
    # Bump version
    switch ($BumpType) {
        'major' { $major++; $minor = 0; $patch = 0 }
        'minor' { $minor++; $patch = 0 }
        'patch' { $patch++ }
    }
    
    return "$major.$minor.$patch"
}

# Update a specific package file with new version
function Update-PackageVersion {
    param(
        [Parameter(Mandatory=$true)]
        [string]$FilePath,
        [Parameter(Mandatory=$true)]
        [string]$NewVersion,
        [Parameter(Mandatory=$true)]
        [string]$ComponentName
    )
    
    if (-not (Test-Path $FilePath)) {
        Write-ColorOutput "$ComponentName not found, skipping" -Type Warning
        return
    }
    
    $content = Get-Content $FilePath -Raw | ConvertFrom-Json
    $content.version = $NewVersion
    $content | ConvertTo-Json -Depth 10 | Set-Content $FilePath -Encoding UTF8
    Write-ColorOutput "Updated $ComponentName to $NewVersion" -Type Success
}

# Get calendar-based version (YYYY.MM.DD or YYYY.MM.DD.N)
function Get-CalendarVersion {
    param(
        [Parameter()]
        [switch]$WithSequence
    )
    
    $date = Get-Date
    $baseVersion = "{0:yyyy.MM.dd}" -f $date
    
    if ($WithSequence) {
        # Check if there are existing tags for today
        try {
            $todayTags = git tag -l "$baseVersion*" 2>$null | Where-Object { $_ -match "^$baseVersion(\.\d+)?$" }
            
            if ($todayTags) {
                # Find highest sequence number
                $sequences = $todayTags | ForEach-Object {
                    if ($_ -match "^$baseVersion\.(\d+)$") {
                        [int]$matches[1]
                    } else {
                        0
                    }
                }
                $nextSeq = ($sequences | Measure-Object -Maximum).Maximum + 1
                return "$baseVersion.$nextSeq"
            }
        } catch {
            # Git not available or no tags, use sequence 1
        }
        
        # First release today, use .1
        return "$baseVersion.1"
    }
    
    return $baseVersion
}

# Create distribution ZIP files
function New-DistributionZip {
    param(
        [Parameter(Mandatory=$true)]
        [string]$Version,
        [Parameter()]
        [switch]$Backend,
        [Parameter()]
        [switch]$Frontend
    )
    
    if (-not (Test-Path $DashboardBuildDir)) {
        Write-ColorOutput "Dashboard dist directory not found, cannot create ZIPs" -Type Warning
        return @()
    }
    
    $zipPaths = @()
    
    # Create backend ZIP
    if ($Backend) {
        $backendDist = Join-Path $DashboardBuildDir "backend"
        if (Test-Path $backendDist) {
            $zipName = "backend.v$Version.zip"
            $zipPath = Join-Path $ReleasesDir $zipName
            
            # Ensure releases directory exists
            if (-not (Test-Path $ReleasesDir)) {
                New-Item -Path $ReleasesDir -ItemType Directory -Force | Out-Null
            }
            
            Write-ColorOutput "Creating $zipName..." -Type Info
            
            try {
                # Remove existing ZIP if present
                if (Test-Path $zipPath) {
                    Remove-Item $zipPath -Force
                }
                
                # Create ZIP
                Compress-Archive -Path "$backendDist\*" -DestinationPath $zipPath -CompressionLevel Optimal
                Write-ColorOutput "Created backend ZIP: $zipPath" -Type Success
                $zipPaths += $zipPath
            } catch {
                Write-ColorOutput "Failed to create backend ZIP: $_" -Type Error
            }
        } else {
            Write-ColorOutput "Backend dist not found at $backendDist" -Type Warning
        }
    }
    
    # Create frontend ZIP
    if ($Frontend) {
        $frontendDist = Join-Path $DashboardBuildDir "frontend"
        if (Test-Path $frontendDist) {
            $zipName = "frontend.v$Version.zip"
            $zipPath = Join-Path $ReleasesDir $zipName
            
            # Ensure releases directory exists
            if (-not (Test-Path $ReleasesDir)) {
                New-Item -Path $ReleasesDir -ItemType Directory -Force | Out-Null
            }
            
            Write-ColorOutput "Creating $zipName..." -Type Info
            
            try {
                # Remove existing ZIP if present
                if (Test-Path $zipPath) {
                    Remove-Item $zipPath -Force
                }
                
                # Create ZIP
                Compress-Archive -Path "$frontendDist\*" -DestinationPath $zipPath -CompressionLevel Optimal
                Write-ColorOutput "Created frontend ZIP: $zipPath" -Type Success
                $zipPaths += $zipPath
            } catch {
                Write-ColorOutput "Failed to create frontend ZIP: $_" -Type Error
            }
        } else {
            Write-ColorOutput "Frontend dist not found at $frontendDist" -Type Warning
        }
    }
    
    return $zipPaths
}

# Handle version bumping for specified components
function Update-ComponentVersions {
    param(
        [string]$BumpType,
        [bool]$IsBeta,
        [bool]$BumpMCP,
        [bool]$BumpDashboard,
        [bool]$BumpBackend,
        [bool]$BumpFrontend
    )
    
    $versions = @{
        MCP = $null
        Dashboard = $null
        Backend = $null
        Frontend = $null
    }
    
    # Bump MCP version if requested
    if ($BumpMCP) {
        $manifestPath = Join-Path $MCPRoot "manifest.json"
        $currentVersion = Get-VersionFromFile -FilePath $manifestPath -FileType "manifest"
        
        if ($currentVersion) {
            Write-ColorOutput "MCP current version: $currentVersion" -Type Info
            $newBaseVersion = Get-BumpedVersion -CurrentVersion $currentVersion -BumpType $BumpType
            
            if ($IsBeta) {
                $versions.MCP = Get-NextBetaVersion -BaseVersion $newBaseVersion
                Write-ColorOutput "MCP new beta version: $($versions.MCP)" -Type Success
            } else {
                $versions.MCP = $newBaseVersion
                Write-ColorOutput "MCP new version: $($versions.MCP)" -Type Success
            }
            
            # Update manifest and MCP package.json
            Update-PackageVersion -FilePath $manifestPath -NewVersion $newBaseVersion -ComponentName "mcp/manifest.json"
            
            $mcpPackagePath = Join-Path $MCPRoot "package.json"
            Update-PackageVersion -FilePath $mcpPackagePath -NewVersion $newBaseVersion -ComponentName "mcp/package.json"
        }
    }
    
    # Bump Dashboard root version if requested
    if ($BumpDashboard) {
        $dashboardPackagePath = Join-Path $DashboardRoot "package.json"
        $currentVersion = Get-VersionFromFile -FilePath $dashboardPackagePath -FileType "package"
        
        if ($currentVersion) {
            Write-ColorOutput "Dashboard current version: $currentVersion" -Type Info
            $versions.Dashboard = Get-BumpedVersion -CurrentVersion $currentVersion -BumpType $BumpType
            Write-ColorOutput "Dashboard new version: $($versions.Dashboard)" -Type Success
            
            Update-PackageVersion -FilePath $dashboardPackagePath -NewVersion $versions.Dashboard -ComponentName "dashboard/package.json"
        }
    }
    
    # Bump Backend version if requested
    if ($BumpBackend) {
        $backendPackagePath = Join-Path $DashboardRoot "backend\package.json"
        $currentVersion = Get-VersionFromFile -FilePath $backendPackagePath -FileType "package"
        
        if ($currentVersion) {
            Write-ColorOutput "Backend current version: $currentVersion" -Type Info
            $versions.Backend = Get-BumpedVersion -CurrentVersion $currentVersion -BumpType $BumpType
            Write-ColorOutput "Backend new version: $($versions.Backend)" -Type Success
            
            Update-PackageVersion -FilePath $backendPackagePath -NewVersion $versions.Backend -ComponentName "dashboard/backend/package.json"
        }
    }
    
    # Bump Frontend version if requested
    if ($BumpFrontend) {
        $frontendPackagePath = Join-Path $DashboardRoot "frontend\package.json"
        $currentVersion = Get-VersionFromFile -FilePath $frontendPackagePath -FileType "package"
        
        if ($currentVersion) {
            Write-ColorOutput "Frontend current version: $currentVersion" -Type Info
            $versions.Frontend = Get-BumpedVersion -CurrentVersion $currentVersion -BumpType $BumpType
            Write-ColorOutput "Frontend new version: $($versions.Frontend)" -Type Success
            
            Update-PackageVersion -FilePath $frontendPackagePath -NewVersion $versions.Frontend -ComponentName "dashboard/frontend/package.json"
        }
    }
    
    return $versions
}

# Get git commit hash for beta versioning
function Get-GitHash {
    Push-Location $ScriptRoot
    try {
        $hash = git rev-parse --short HEAD 2>$null
        if ($LASTEXITCODE -eq 0 -and $hash) {
            return $hash.Trim()
        }
    } catch {
        Write-ColorOutput "Could not get git hash: $_" -Type Warning
    } finally {
        Pop-Location
    }
    
    # Fallback to timestamp if git not available
    return (Get-Date -Format "yyyyMMddHHmmss")
}

# Get next beta version number
function Get-NextBetaVersion {
    param([string]$BaseVersion)
    
    # Check existing beta releases
    $existingBetas = Get-ChildItem -Path $ReleasesDir -Filter "sports-data-mcp-v$BaseVersion-beta.*.mcpb" -ErrorAction SilentlyContinue
    
    if ($existingBetas) {
        # Find highest beta number
        $betaNumbers = $existingBetas | ForEach-Object {
            if ($_.Name -match 'beta\.(\d+)\.mcpb$') {
                [int]$matches[1]
            }
        }
        $nextBeta = ($betaNumbers | Measure-Object -Maximum).Maximum + 1
    } else {
        $nextBeta = 1
    }
    
    return "$BaseVersion-beta.$nextBeta"
}

# Build MCPB package
function Build-MCPBPackage {
    param([string]$Version)
    
    Write-ColorOutput "Building MCPB package for version $Version..." -Type Info
    
    # Create build directory
    if (-not (Test-Path $BuildDir)) {
        New-Item -Path $BuildDir -ItemType Directory | Out-Null
    }
    
    # Install dependencies if needed
    Write-ColorOutput "Checking dependencies..." -Type Info
    $requirementsPath = Join-Path $MCPRoot "requirements.txt"
    
    try {
        python -m pip install --upgrade pip -q
        python -m pip install -r $requirementsPath -q
        Write-ColorOutput "Dependencies installed" -Type Success
    } catch {
        Write-ColorOutput "Failed to install dependencies: $_" -Type Error
        exit 1
    }
    
    # Create MCPB package manually (ZIP format with manifest)
    Write-ColorOutput "Creating MCPB package structure..." -Type Info
    
    $packageDir = Join-Path $BuildDir "sports-data-mcp"
    if (Test-Path $packageDir) {
        Remove-Item -Path $packageDir -Recurse -Force
    }
    New-Item -Path $packageDir -ItemType Directory | Out-Null
    
    # Files to include in MCPB package
    $filesToCopy = @(
        "sports_mcp_server.py",
        "manifest.json",
        "requirements.txt",
        "mcpb_bootstrap.py",
        "setup.py",
        "LICENSE",
        ".env.example",
        "INSTALL_INSTRUCTIONS.md"
    )
    
    # Copy main files
    foreach ($file in $filesToCopy) {
        $sourcePath = Join-Path $MCPRoot $file
        if (Test-Path $sourcePath) {
            Copy-Item -Path $sourcePath -Destination $packageDir -Force
            Write-ColorOutput "Copied: $file" -Type Info
        }
    }
    
    # NOTE: We do NOT copy .env file to the package to prevent overwriting user's API key on updates
    # Users should manually create .env from .env.example on first install only
    
    # Copy sports_api directory
    $sportsApiSource = Join-Path $MCPRoot "sports_api"
    $sportsApiDest = Join-Path $packageDir "sports_api"
    if (Test-Path $sportsApiSource) {
        Copy-Item -Path $sportsApiSource -Destination $sportsApiDest -Recurse -Force
        # Remove __pycache__ from copied files
        Get-ChildItem -Path $sportsApiDest -Recurse -Directory -Filter "__pycache__" | Remove-Item -Recurse -Force
        Get-ChildItem -Path $sportsApiDest -Recurse -Filter "*.pyc" | Remove-Item -Force
    }
    
    # Create .mcpb package (ZIP file with .mcpb extension)
    Write-ColorOutput "Creating MCPB archive..." -Type Info
    
    if (-not (Test-Path $ReleasesDir)) {
        New-Item -Path $ReleasesDir -ItemType Directory | Out-Null
    }
    
    $mcpbPath = Join-Path $ReleasesDir "sports-data-mcp-v$Version.mcpb"
    
    # Remove existing MCPB file if present
    if (Test-Path $mcpbPath) {
        Remove-Item -Path $mcpbPath -Force
    }
    
    try {
        # Create ZIP archive with .mcpb extension
        Compress-Archive -Path "$packageDir\*" -DestinationPath $mcpbPath -CompressionLevel Optimal -Force
        Write-ColorOutput "MCPB package created successfully" -Type Success
        Write-ColorOutput "Package saved to: $mcpbPath" -Type Success
        return $mcpbPath
    } catch {
        Write-ColorOutput "Failed to create MCPB archive: $_" -Type Error
        exit 1
    }
}

# Build Dashboard (React frontend + Node.js backend)
function Build-Dashboard {
    Write-ColorOutput "Building Dashboard..." -Type Info
    
    if (-not (Test-Path $DashboardRoot)) {
        Write-ColorOutput "Dashboard directory not found at $DashboardRoot" -Type Error
        return $false
    }
    
    Push-Location $DashboardRoot
    try {
        # Check for Node.js
        if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
            Write-ColorOutput "Node.js not found. Please install Node.js 20+ from https://nodejs.org/" -Type Error
            return $false
        }
        
        $nodeVersion = node --version
        Write-ColorOutput "Using Node.js $nodeVersion" -Type Info
        
        # Install dependencies if needed
        if (-not (Test-Path "node_modules")) {
            Write-ColorOutput "Installing dashboard dependencies..." -Type Info
            npm install
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "Failed to install dashboard dependencies" -Type Error
                return $false
            }
        }
        
        # Build backend
        Write-ColorOutput "Building backend..." -Type Info
        npm run build:backend
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "Backend build failed" -Type Error
            return $false
        }
        Write-ColorOutput "Backend built successfully" -Type Success
        
        # Build frontend
        Write-ColorOutput "Building frontend..." -Type Info
        npm run build:frontend
        if ($LASTEXITCODE -ne 0) {
            Write-ColorOutput "Frontend build failed" -Type Error
            return $false
        }
        Write-ColorOutput "Frontend built successfully" -Type Success
        
        # Create unified dist directory
        if (-not (Test-Path $DashboardBuildDir)) {
            New-Item -Path $DashboardBuildDir -ItemType Directory | Out-Null
        }
        
        # Copy backend build
        $backendDist = Join-Path $DashboardRoot "backend\dist"
        $backendTarget = Join-Path $DashboardBuildDir "backend"
        if (Test-Path $backendDist) {
            Copy-Item -Path $backendDist -Destination $backendTarget -Recurse -Force
            Write-ColorOutput "Copied backend build to dist/" -Type Success
        }
        
        # Copy frontend build
        $frontendDist = Join-Path $DashboardRoot "frontend\dist"
        $frontendTarget = Join-Path $DashboardBuildDir "frontend"
        if (Test-Path $frontendDist) {
            Copy-Item -Path $frontendDist -Destination $frontendTarget -Recurse -Force
            Write-ColorOutput "Copied frontend build to dist/" -Type Success
        }
        
        # Copy necessary files for deployment
        $filesToCopy = @(
            @{Source="package.json"; Dest=$DashboardBuildDir},
            @{Source="backend\package.json"; Dest=(Join-Path $DashboardBuildDir "backend")},
            @{Source="backend\.env.example"; Dest=(Join-Path $DashboardBuildDir "backend")},
            @{Source="backend\prisma"; Dest=(Join-Path $DashboardBuildDir "backend"); IsDir=$true},
            @{Source="README.md"; Dest=$DashboardBuildDir},
            @{Source="DEPLOYMENT.md"; Dest=$DashboardBuildDir}
        )
        
        foreach ($file in $filesToCopy) {
            $sourcePath = Join-Path $DashboardRoot $file.Source
            if (Test-Path $sourcePath) {
                if ($file.IsDir) {
                    Copy-Item -Path $sourcePath -Destination $file.Dest -Recurse -Force
                } else {
                    $destDir = Split-Path -Parent $file.Dest
                    if (-not (Test-Path $destDir)) {
                        New-Item -Path $destDir -ItemType Directory -Force | Out-Null
                    }
                    Copy-Item -Path $sourcePath -Destination $file.Dest -Force
                }
                Write-ColorOutput "Copied: $($file.Source)" -Type Info
            }
        }
        
        Write-ColorOutput "Dashboard build complete" -Type Success
        Write-ColorOutput "Build output: $DashboardBuildDir" -Type Info
        return $true
        
    } catch {
        Write-ColorOutput "Dashboard build failed: $_" -Type Error
        return $false
    } finally {
        Pop-Location
    }
}

# Create GitHub release
function New-GitHubRelease {
    param(
        [string]$Version,
        [string]$PackagePath
    )
    
    Write-ColorOutput "Creating GitHub release for v$Version..." -Type Info
    
    # Check if git repo
    if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
        Write-ColorOutput "Not a git repository, skipping release" -Type Warning
        return
    }
    
    # Commit version changes
    Push-Location $ProjectRoot
    try {
        git add mcp/manifest.json mcp/package.json dashboard/package.json dashboard/backend/package.json dashboard/frontend/package.json
        git commit -m "Release v$Version"
        git tag -a "v$Version" -m "Release version $Version"
        git push origin main
        git push origin "v$Version"
        Write-ColorOutput "Version committed and tagged" -Type Success
    } catch {
        Write-ColorOutput "Git operations failed: $_" -Type Warning
    } finally {
        Pop-Location
    }
    
    # Check for GitHub CLI
    if (Get-Command gh -ErrorAction SilentlyContinue) {
        try {
            gh release create "v$Version" `
                --title "Sports Data MCP v$Version" `
                --notes "Release version $Version" `
                $PackagePath
            Write-ColorOutput "GitHub release created" -Type Success
        } catch {
            Write-ColorOutput "Failed to create GitHub release: $_" -Type Warning
        }
    } else {
        Write-ColorOutput "GitHub CLI not found, skipping release creation" -Type Warning
        Write-ColorOutput "Install from: https://cli.github.com/" -Type Info
    }
}

# Main execution
function Main {
    Write-ColorOutput "=== Sports Data Build Script ===" -Type Info
    Write-ColorOutput "Script root: $ScriptRoot" -Type Info
    
    # Handle full release workflow
    if ($FullRelease) {
        if (-not $VersionBump) {
            Write-ColorOutput "FullRelease requires -VersionBump parameter" -Type Error
            exit 1
        }
        Invoke-FullRelease -VersionBump $VersionBump -PushDocker:$PushDocker
        return
    }
    
    # Default to MCP build if neither flag specified
    if (-not $MCP -and -not $Dashboard) {
        Write-ColorOutput "No build target specified. Use -MCP and/or -Dashboard flags." -Type Warning
        Write-ColorOutput "Examples:" -Type Info
        Write-ColorOutput "  .\build.ps1 -MCP -VersionBump patch" -Type Info
        Write-ColorOutput "  .\build.ps1 -Dashboard" -Type Info
        Write-ColorOutput "  .\build.ps1 -MCP -Dashboard -VersionBump minor" -Type Info
        Write-ColorOutput "  .\build.ps1 -FullRelease -VersionBump patch" -Type Info
        return
    }
    
    # Clean if requested
    if ($Clean) {
        if ($MCP -and -not $Dashboard) {
            Clean-BuildArtifacts -MCPOnly
        } elseif ($Dashboard -and -not $MCP) {
            Clean-BuildArtifacts -DashboardOnly
        } else {
            Clean-BuildArtifacts
        }
        
        if (-not $VersionBump -and -not $MCP -and -not $Dashboard) {
            Write-ColorOutput "Clean completed" -Type Success
            return
        }
    }
    
    # Get current MCP version for building (before any version bumps)
    $mcpVersion = $null
    if ($MCP) {
        $manifestPath = Join-Path $MCPRoot "manifest.json"
        $mcpVersion = Get-VersionFromFile -FilePath $manifestPath -FileType "manifest"
        
        # Add beta suffix if requested
        if ($Beta -and $mcpVersion) {
            if ($VersionBump -and $BumpMCP) {
                # Will determine beta version after build succeeds
                $mcpVersion = $null
            } else {
                # Beta without version bump: use git hash
                $gitHash = Get-GitHash
                $mcpVersion = "$mcpVersion-beta.$gitHash"
                Write-ColorOutput "Using beta version with git hash: $mcpVersion" -Type Success
            }
        }
    }
    
    # Build Dashboard if requested
    $dashboardSuccess = $true
    if ($Dashboard) {
        $dashboardSuccess = Build-Dashboard
        if (-not $dashboardSuccess) {
            Write-ColorOutput "Dashboard build failed - versions not updated" -Type Error
            if (-not $MCP) {
                exit 1
            }
        }
    }
    
    # Build MCP if requested
    $mcpPackagePath = $null
    $mcpBuildSuccess = $true
    if ($MCP) {
        # Use current version if not bumping
        if (-not $mcpVersion) {
            $manifestPath = Join-Path $MCPRoot "manifest.json"
            $mcpVersion = Get-VersionFromFile -FilePath $manifestPath -FileType "manifest"
        }
        
        if (-not $mcpVersion) {
            Write-ColorOutput "No MCP version available for build" -Type Error
            exit 1
        }
        
        # Build MCP package
        try {
            $mcpPackagePath = Build-MCPBPackage -Version $mcpVersion
        } catch {
            Write-ColorOutput "MCP build failed - version not updated" -Type Error
            $mcpBuildSuccess = $false
            if (-not $Dashboard -or -not $dashboardSuccess) {
                exit 1
            }
        }
    }
    
    # Bump versions AFTER successful builds
    $versions = @{}
    if ($VersionBump) {
        # Only proceed with version bumps if respective builds succeeded
        $shouldBumpMCP = $BumpMCP.IsPresent -and $MCP -and $mcpBuildSuccess
        $shouldBumpDashboard = $BumpDashboard.IsPresent -and $Dashboard -and $dashboardSuccess
        $shouldBumpBackend = $BumpBackend.IsPresent -and $Dashboard -and $dashboardSuccess
        $shouldBumpFrontend = $BumpFrontend.IsPresent -and $Dashboard -and $dashboardSuccess
        
        if ($shouldBumpMCP -or $shouldBumpDashboard -or $shouldBumpBackend -or $shouldBumpFrontend) {
            Write-ColorOutput "Builds succeeded - updating versions..." -Type Info
            
            $versions = Update-ComponentVersions `
                -BumpType $VersionBump `
                -IsBeta $Beta.IsPresent `
                -BumpMCP $shouldBumpMCP `
                -BumpDashboard $shouldBumpDashboard `
                -BumpBackend $shouldBumpBackend `
                -BumpFrontend $shouldBumpFrontend
            
            # Update MCP version with beta suffix if needed
            if ($versions.MCP) {
                $mcpVersion = $versions.MCP
            }
            
            # Update package.json files in dist folder to reflect new versions
            if ($Dashboard -and $dashboardSuccess -and (Test-Path $DashboardBuildDir)) {
                if ($shouldBumpDashboard) {
                    $distRootPackage = Join-Path $DashboardBuildDir "package.json"
                    $sourceRootPackage = Join-Path $DashboardRoot "package.json"
                    if (Test-Path $sourceRootPackage) {
                        Copy-Item -Path $sourceRootPackage -Destination $distRootPackage -Force
                        Write-ColorOutput "Updated dist/package.json with new version" -Type Info
                    }
                }
                if ($shouldBumpBackend) {
                    $distBackendPackage = Join-Path $DashboardBuildDir "backend\package.json"
                    $sourceBackendPackage = Join-Path $DashboardRoot "backend\package.json"
                    if (Test-Path $sourceBackendPackage) {
                        Copy-Item -Path $sourceBackendPackage -Destination $distBackendPackage -Force
                        Write-ColorOutput "Updated dist/backend/package.json with new version" -Type Info
                    }
                }
                if ($shouldBumpFrontend) {
                    $distFrontendPackage = Join-Path $DashboardBuildDir "frontend\package.json"
                    $sourceFrontendPackage = Join-Path $DashboardRoot "frontend\package.json"
                    if (Test-Path $sourceFrontendPackage) {
                        $distFrontendDir = Join-Path $DashboardBuildDir "frontend"
                        if (-not (Test-Path $distFrontendDir)) {
                            New-Item -Path $distFrontendDir -ItemType Directory -Force | Out-Null
                        }
                        Copy-Item -Path $sourceFrontendPackage -Destination $distFrontendPackage -Force
                        Write-ColorOutput "Updated dist/frontend/package.json with new version" -Type Info
                    }
                }
            }
        } else {
            Write-ColorOutput "No builds succeeded - versions not updated" -Type Warning
        }
    }
    
    # Create release if requested (MCP only)
    if ($MCP -and $Release -and $BumpMCP -and $mcpBuildSuccess) {
        if ($Beta) {
            Write-ColorOutput "Beta releases are not pushed to GitHub" -Type Warning
        } else {
            New-GitHubRelease -Version $mcpVersion -PackagePath $mcpPackagePath
        }
    }
    
    # Summary
    Write-ColorOutput "=== Build Complete ===" -Type Success
    
    if ($MCP -and $mcpPackagePath) {
        Write-ColorOutput "MCP Package: $mcpPackagePath" -Type Info
        
        if ($Beta) {
            Write-ColorOutput "Beta release created for testing" -Type Info
            Write-ColorOutput "To promote to stable, run: .\build.ps1 -MCP -VersionBump $VersionBump" -Type Info
        } elseif (-not $Release) {
            Write-ColorOutput "To create a GitHub release, run with -Release flag" -Type Info
        }
    }
    
    if ($Dashboard) {
        if ($dashboardSuccess) {
            Write-ColorOutput "Dashboard Build: $DashboardBuildDir" -Type Info
            Write-ColorOutput "Deploy by copying dist/ contents to your server" -Type Info
        } else {
            Write-ColorOutput "Dashboard build encountered errors" -Type Warning
        }
    }
}

# Full release workflow
function Invoke-FullRelease {
    param(
        [Parameter(Mandatory=$true)]
        [string]$VersionBump,
        [Parameter()]
        [switch]$PushDocker
    )
    
    Write-ColorOutput "=== Full Release Workflow ===" -Type Info
    
    # Step 1: Generate calendar version for release tag
    $releaseTag = Get-CalendarVersion -WithSequence
    Write-ColorOutput "Release tag: $releaseTag" -Type Info
    
    # Step 2: Clean build artifacts
    Write-ColorOutput "Step 1/7: Cleaning build artifacts..." -Type Info
    Clean-BuildArtifacts
    
    # Step 3: Build Dashboard
    Write-ColorOutput "Step 2/7: Building Dashboard..." -Type Info
    $dashboardSuccess = Build-Dashboard
    if (-not $dashboardSuccess) {
        Write-ColorOutput "Dashboard build failed, aborting release" -Type Error
        exit 1
    }
    
    # Step 4: Build MCP
    Write-ColorOutput "Step 3/7: Building MCP..." -Type Info
    $manifestPath = Join-Path $MCPRoot "manifest.json"
    $mcpVersion = Get-VersionFromFile -FilePath $manifestPath -FileType "manifest"
    
    if (-not $mcpVersion) {
        Write-ColorOutput "Failed to get MCP version, aborting release" -Type Error
        exit 1
    }
    
    $mcpPackagePath = Build-MCPBPackage -Version $mcpVersion
    if (-not $mcpPackagePath) {
        Write-ColorOutput "MCP build failed, aborting release" -Type Error
        exit 1
    }
    
    # Step 5: Bump versions
    Write-ColorOutput "Step 4/7: Bumping versions..." -Type Info
    $versions = Update-ComponentVersions `
        -BumpType $VersionBump `
        -IsBeta $false `
        -BumpMCP $true `
        -BumpDashboard $true `
        -BumpBackend $true `
        -BumpFrontend $true
    
    # Get the dashboard version for ZIPs and Docker
    $dashboardVersion = $versions.Dashboard
    if (-not $dashboardVersion) {
        $dashboardPackagePath = Join-Path $DashboardRoot "package.json"
        $dashboardVersion = Get-VersionFromFile -FilePath $dashboardPackagePath -FileType "package"
    }
    
    # Step 6: Create distribution ZIPs
    Write-ColorOutput "Step 5/7: Creating distribution ZIPs..." -Type Info
    $zipPaths = New-DistributionZip -Version $dashboardVersion -Backend -Frontend
    
    if ($zipPaths.Count -gt 0) {
        foreach ($zip in $zipPaths) {
            Write-ColorOutput "Created: $zip" -Type Success
        }
    } else {
        Write-ColorOutput "Warning: No ZIPs created" -Type Warning
    }
    
    # Step 7: Build and push Docker images
    Write-ColorOutput "Step 6/7: Building Docker images..." -Type Info
    $dockerScriptPath = Join-Path (Split-Path -Parent $PSCommandPath) "docker-build.ps1"
    
    if (Test-Path $dockerScriptPath) {
        $dockerArgs = @{
            Version = $releaseTag
            Backend = $true
            Frontend = $true
            Push = $PushDocker
        }
        
        try {
            & $dockerScriptPath @dockerArgs
            if ($LASTEXITCODE -ne 0) {
                Write-ColorOutput "Docker build failed, but continuing with release..." -Type Warning
            }
        } catch {
            Write-ColorOutput "Docker build error: $_" -Type Warning
            Write-ColorOutput "Continuing with release..." -Type Info
        }
    } else {
        Write-ColorOutput "docker-build.ps1 not found, skipping Docker builds" -Type Warning
    }
    
    # Step 8: Create GitHub release
    Write-ColorOutput "Step 7/7: Creating GitHub release..." -Type Info
    
    # Collect all artifacts
    $artifacts = @($mcpPackagePath) + $zipPaths
    
    # Check if git repo
    if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
        Write-ColorOutput "Not a git repository, skipping GitHub release" -Type Warning
    } else {
        # Commit version changes
        Push-Location $ProjectRoot
        try {
            git add .
            git commit -m "Release $releaseTag

- MCP Server: v$($versions.MCP)
- Dashboard: v$dashboardVersion
- Backend: v$($versions.Backend)
- Frontend: v$($versions.Frontend)"
            
            git tag -a "$releaseTag" -m "Release $releaseTag"
            git push origin main
            git push origin "$releaseTag"
            Write-ColorOutput "Version committed and tagged" -Type Success
            
            # Create GitHub release with gh CLI
            if (Get-Command gh -ErrorAction SilentlyContinue) {
                $releaseNotes = @"
# Release $releaseTag

## Components

- **MCP Server**: v$($versions.MCP)
- **Dashboard**: v$dashboardVersion
  - Backend: v$($versions.Backend)
  - Frontend: v$($versions.Frontend)

## Docker Images

``````bash
# Backend
docker pull ghcr.io/<owner>/$Repository-backend:$releaseTag
docker pull ghcr.io/<owner>/$Repository-backend:latest

# Frontend  
docker pull ghcr.io/<owner>/$Repository-frontend:$releaseTag
docker pull ghcr.io/<owner>/$Repository-frontend:latest
``````

## Assets

- **MCPB Package**: Install with Claude Desktop
- **Backend ZIP**: Compiled Node.js backend
- **Frontend ZIP**: Built React frontend for nginx/Apache
"@
                
                try {
                    $ghArgs = @(
                        "release", "create", $releaseTag,
                        "--title", "Release $releaseTag",
                        "--notes", $releaseNotes
                    )
                    
                    # Add all artifact files
                    foreach ($artifact in $artifacts) {
                        if (Test-Path $artifact) {
                            $ghArgs += $artifact
                        }
                    }
                    
                    & gh @ghArgs
                    
                    if ($LASTEXITCODE -eq 0) {
                        Write-ColorOutput "GitHub release created successfully" -Type Success
                    } else {
                        Write-ColorOutput "GitHub release creation failed" -Type Warning
                    }
                } catch {
                    Write-ColorOutput "Failed to create GitHub release: $_" -Type Warning
                }
            } else {
                Write-ColorOutput "GitHub CLI not found, skipping release creation" -Type Warning
                Write-ColorOutput "Install from: https://cli.github.com/" -Type Info
            }
        } catch {
            Write-ColorOutput "Git operations failed: $_" -Type Warning
        } finally {
            Pop-Location
        }
    }
    
    # Final summary
    Write-ColorOutput "=== Full Release Complete ===" -Type Success
    Write-ColorOutput "Release Tag: $releaseTag" -Type Info
    Write-ColorOutput "MCP Version: v$($versions.MCP)" -Type Info
    Write-ColorOutput "Dashboard Version: v$dashboardVersion" -Type Info
    Write-ColorOutput "" -Type Info
    Write-ColorOutput "Artifacts:" -Type Info
    foreach ($artifact in $artifacts) {
        if (Test-Path $artifact) {
            Write-ColorOutput "  - $(Split-Path -Leaf $artifact)" -Type Info
        }
    }
    
    if ($PushDocker) {
        Write-ColorOutput "" -Type Info
        Write-ColorOutput "Docker images pushed to GitHub Container Registry" -Type Success
    } else {
        Write-ColorOutput "" -Type Info
        Write-ColorOutput "Docker images built locally (use -PushDocker to publish)" -Type Info
    }
}

# Run main
Main
