#!/usr/bin/env bash
set -euo pipefail

npm run build >/dev/null

for file in examples/invoice-*.json; do
  output="$(node dist/cli/index.js simulate --input "$file")"
  node -e "const data = JSON.parse(process.argv[1]); if (!data.totals || typeof data.totals.total !== 'number') process.exit(1)" "$output"
done
