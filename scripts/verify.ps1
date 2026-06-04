param(
  [switch]$SkipWeb,
  [switch]$SkipE2E,
  [switch]$SkipDocker
)

$ErrorActionPreference = "Stop"

function Invoke-Step {
  param(
    [string]$Name,
    [scriptblock]$Command
  )

  Write-Host "==> $Name"
  & $Command
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $root
try {
  Invoke-Step "root lint" { npm run lint }
  Invoke-Step "root typecheck" { npm run typecheck }
  Invoke-Step "root tests" { npm test }
  Invoke-Step "root build" { npm run build }

  $gitBash = "C:\Program Files\Git\bin\bash.exe"
  if (Test-Path $gitBash) {
    Invoke-Step "scan" { & $gitBash scripts/scan.sh }
    Invoke-Step "smoke" { & $gitBash scripts/smoke.sh }
  } else {
    Write-Warning "Git Bash not found; skipping scan.sh and smoke.sh"
  }

  if (-not $SkipWeb) {
    Push-Location (Join-Path $root "web")
    try {
      Invoke-Step "web lint" { npm run lint }
      Invoke-Step "web typecheck" { npm run typecheck }
      Invoke-Step "web coverage" { npm run test:coverage }
      Invoke-Step "web build" { npm run build }
      if (-not $SkipE2E) {
        Invoke-Step "web e2e" { npm run e2e }
      }
    } finally {
      Pop-Location
    }
  }

  if (-not $SkipDocker) {
    Invoke-Step "docker build" {
      $previousToken = $env:LEDGERFLOW_API_TOKEN
      try {
        if (-not $previousToken) {
          $env:LEDGERFLOW_API_TOKEN = "verify-token"
        }
        docker compose build
      } finally {
        if ($null -eq $previousToken) {
          Remove-Item Env:LEDGERFLOW_API_TOKEN -ErrorAction SilentlyContinue
        } else {
          $env:LEDGERFLOW_API_TOKEN = $previousToken
        }
      }
    }
  }
} finally {
  Pop-Location
}

Write-Host "verification passed"
