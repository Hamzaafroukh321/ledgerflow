#!/usr/bin/env bash
set -euo pipefail

if git ls-files | grep -E '(^|/)\.env$|node_modules/|^dist/|^coverage/|\.sqlite($|-)'; then
  echo "scan failed: generated, local, or secret-bearing files are tracked"
  exit 1
fi

if git grep -n -E 'TODO|FIXME|api[_-]?key|password|secret|evaluation program|benchmark tooling' -- ':!scripts/scan.sh' ':!SCALE_PROMPT.md'; then
  echo "scan failed: disallowed marker found"
  exit 1
fi

if git grep -n -E '\.(only|skip)\(' -- 'test/**' 'web/src/**' 'web/e2e/**'; then
  echo "scan failed: focused or skipped test found"
  exit 1
fi

if git grep -n -E 'Vite \+ React|vite\.svg' -- 'web/**'; then
  echo "scan failed: default Vite shell metadata found"
  exit 1
fi

if git grep -n -E 'TODO|FIXME' -- docs README.md scripts src test examples ':!scripts/scan.sh'; then
  echo "scan failed: unfinished marker found"
  exit 1
fi

echo "scan passed"
