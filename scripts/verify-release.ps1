param(
  [string]$ProjectName = "ledgerflow-release-verify",
  [string]$Port = "3100",
  [string]$Token = "release-verify-token"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)

function Invoke-Checked {
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

function Wait-ForHealth {
  $deadline = (Get-Date).AddSeconds(90)
  do {
    try {
      $response = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/health" -TimeoutSec 3
      if ($response.status -eq "ok") {
        return
      }
    } catch {
      Start-Sleep -Seconds 2
    }
  } while ((Get-Date) -lt $deadline)
  throw "LedgerFlow release stack did not become healthy"
}

Push-Location $root
try {
  $previousToken = $env:LEDGERFLOW_API_TOKEN
  $previousPort = $env:LEDGERFLOW_PORT
  $env:LEDGERFLOW_API_TOKEN = $Token
  $env:LEDGERFLOW_PORT = $Port

  Invoke-Checked "release compose up" {
    docker compose -p $ProjectName -f docker-compose.prod.yml up -d --build
  }
  Wait-ForHealth

  try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/v1/plans" -TimeoutSec 5 | Out-Null
    throw "Unauthenticated plan request unexpectedly succeeded"
  } catch {
    if ($_.Exception.Response.StatusCode.value__ -ne 401) {
      throw
    }
  }

  $headers = @{ Authorization = "Bearer $Token" }
  $ready = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ready" -Headers $headers -TimeoutSec 5
  if ($ready.status -ne "ready") {
    throw "Readiness check did not report ready"
  }
  $plans = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/v1/plans" -Headers $headers -TimeoutSec 5
  if ($plans.page.total -lt 2) {
    throw "Release stack did not expose the seeded plan catalog"
  }
  Write-Host "release verification passed"
} finally {
  docker compose -p $ProjectName -f docker-compose.prod.yml down -v | Out-Host
  if ($null -eq $previousToken) {
    Remove-Item Env:LEDGERFLOW_API_TOKEN -ErrorAction SilentlyContinue
  } else {
    $env:LEDGERFLOW_API_TOKEN = $previousToken
  }
  if ($null -eq $previousPort) {
    Remove-Item Env:LEDGERFLOW_PORT -ErrorAction SilentlyContinue
  } else {
    $env:LEDGERFLOW_PORT = $previousPort
  }
  Pop-Location
}
