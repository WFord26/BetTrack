<#
.SYNOPSIS
    Point this repository's git hooks at scripts/hooks so they are version controlled.
.DESCRIPTION
    Run once per clone. The hooks themselves are bash scripts and run fine under
    Git for Windows, which ships its own bash.
.EXAMPLE
    .\scripts\install-git-hooks.ps1
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
Push-Location (Join-Path $PSScriptRoot '..')
try {
    git config core.hooksPath scripts/hooks
    Write-Host "core.hooksPath set to scripts/hooks" -ForegroundColor Green
    Write-Host "Installed hooks:"
    Get-ChildItem scripts/hooks | ForEach-Object { Write-Host "  $($_.Name)" }

    if (-not (Get-Command gitleaks -ErrorAction SilentlyContinue)) {
        Write-Host ""
        Write-Host "Optional: install gitleaks for a deeper local scan." -ForegroundColor Yellow
        Write-Host "  winget install gitleaks.gitleaks"
    }
}
finally {
    Pop-Location
}
