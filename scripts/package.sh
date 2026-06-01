#!/usr/bin/env bash
set -euo pipefail

rm -f ledgerflow.zip
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "
  \$ErrorActionPreference = 'Stop';
  \$root = (Get-Location).Path;
  \$stage = Join-Path ([System.IO.Path]::GetTempPath()) ('ledgerflow-package-' + [System.Guid]::NewGuid());
  New-Item -ItemType Directory -Path \$stage | Out-Null;
  try {
    git -C \$root ls-files | ForEach-Object {
      \$source = Join-Path \$root \$_.Replace('/', [System.IO.Path]::DirectorySeparatorChar);
      \$target = Join-Path \$stage \$_.Replace('/', [System.IO.Path]::DirectorySeparatorChar);
      New-Item -ItemType Directory -Path (Split-Path \$target) -Force | Out-Null;
      Copy-Item -LiteralPath \$source -Destination \$target;
    };
    New-Item -ItemType Directory -Path (Join-Path \$stage '.git') -Force | Out-Null;
    Copy-Item -LiteralPath (Join-Path \$root '.git/HEAD') -Destination (Join-Path \$stage '.git/HEAD');
    Compress-Archive -Path (Join-Path \$stage '*') -DestinationPath (Join-Path \$root 'ledgerflow.zip') -Force;
  } finally {
    Remove-Item -LiteralPath \$stage -Recurse -Force;
  }
"
echo "ledgerflow.zip"
