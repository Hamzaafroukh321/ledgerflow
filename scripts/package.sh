#!/usr/bin/env bash
set -euo pipefail

rm -f ledgerflow.zip
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  \$ErrorActionPreference = 'Stop';
  \$root = (Get-Location).Path;
  \$items = Get-ChildItem -LiteralPath \$root -Force |
    Where-Object {
      \$_.Name -notin @('node_modules','dist','coverage','ledgerflow.zip') -and
      \$_.Name -notmatch '\.sqlite'
    } |
    ForEach-Object { \$_.FullName };
  Compress-Archive -LiteralPath \$items -DestinationPath (Join-Path \$root 'ledgerflow.zip') -Force
"
echo "ledgerflow.zip"
