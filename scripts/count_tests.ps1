$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$testFiles = Get-ChildItem -LiteralPath $root -Recurse -File |
  Where-Object {
    $_.FullName -notmatch '\\node_modules\\|\\dist\\|\\coverage\\|\\playwright-report\\|\\test-results\\' -and
    ($_.Name -match '\.test\.(ts|tsx)$' -or $_.FullName -match '\\web\\e2e\\.*\.spec\.ts$')
  }

$totalCases = 0
$byArea = @{}
foreach ($file in $testFiles) {
  $content = Get-Content -LiteralPath $file.FullName -Raw
  $cases = ([regex]::Matches($content, "(?m)\b(it|test)\(")).Count
  $totalCases += $cases
  $relative = Resolve-Path -LiteralPath $file.FullName -Relative
  $area = if ($relative -like ".\web\*") { "web" } else { "root" }
  if (-not $byArea.ContainsKey($area)) {
    $byArea[$area] = [ordered]@{ files = 0; cases = 0 }
  }
  $byArea[$area].files += 1
  $byArea[$area].cases += $cases
}

[pscustomobject]@{
  files = $testFiles.Count
  cases = $totalCases
  areas = $byArea
} | ConvertTo-Json -Depth 4
