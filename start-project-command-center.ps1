$ErrorActionPreference = "Stop"

$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
$exePath = Join-Path $repo "apps\windows\dist-desktop\win-unpacked\Project Command Center.exe"

function Test-CommandExists {
  param([string] $Command)
  return [bool](Get-Command $Command -ErrorAction SilentlyContinue)
}

if (-not (Test-CommandExists "node")) {
  throw "Node.js is not available on PATH."
}

if (-not (Test-CommandExists "corepack")) {
  throw "Corepack is not available on PATH."
}

Write-Host "Starting Project Command Center desktop app..." -ForegroundColor Cyan
Write-Host "Repo: $repo"

Push-Location $repo
try {
  if (-not (Test-Path $exePath)) {
    Write-Host "Packaged .exe not found. Building Windows desktop package..."
    & corepack pnpm --filter "@pcc/windows" desktop:pack
    if ($LASTEXITCODE -ne 0) {
      throw "desktop package build failed with exit code $LASTEXITCODE"
    }
  }
} finally {
  Pop-Location
}

if (-not (Test-Path $exePath)) {
  throw "Could not find packaged desktop executable at $exePath"
}

Start-Process -FilePath $exePath
Write-Host "Project Command Center desktop app launched:" -ForegroundColor Green
Write-Host $exePath
