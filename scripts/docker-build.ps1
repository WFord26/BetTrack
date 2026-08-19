<#
.SYNOPSIS
    BetTrack Docker Build - shim.

.DESCRIPTION
    The implementation now lives in scripts/docker-build.mjs, so macOS, Linux
    and Windows share one codebase instead of three. This wrapper stays so
    existing invocations keep working; every argument is forwarded as-is,
    including the old -Backend / -Frontend spellings.

.EXAMPLE
    .\docker-build.ps1 -Backend -Frontend -Push
    .\docker-build.ps1 all --push --latest
    node scripts/docker-build.mjs --help
#>

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Error 'Node.js is required (>= 22). Install it, then re-run.'
    exit 1
}

# Translate the PowerShell switch style (-Backend) into the script's flags so
# existing commands keep working unchanged.
$forwarded = @()
foreach ($arg in $args) {
    $text = [string]$arg
    if ($text.StartsWith('-') -and -not $text.StartsWith('--')) {
        $forwarded += '--' + $text.Substring(1).ToLower()
    } else {
        $forwarded += $text
    }
}

& node (Join-Path $scriptDir 'docker-build.mjs') @forwarded
exit $LASTEXITCODE
