#!/usr/bin/env bash
set -euo pipefail

echo "LedgerFlow release report"
echo "commit: $(git rev-parse --short HEAD)"
echo "branch: $(git branch --show-current)"
echo
echo "recent commits:"
git log --oneline -5
echo
echo "verification:"
echo "- lint/typecheck/test/build: run npm scripts"
echo "- smoke: scripts/smoke.sh"
echo "- scan: scripts/scan.sh"
echo
echo "test files:"
find test -name '*.test.ts' | sort
echo
echo "examples:"
find examples -name '*.json' | sort
