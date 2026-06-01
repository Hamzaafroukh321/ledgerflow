#!/usr/bin/env bash
set -euo pipefail

npm run build >/dev/null

plans_output="$(node dist/cli/index.js plans)"
node -e "const data = JSON.parse(process.argv[1]); if (!Array.isArray(data) || !data.some((plan) => plan.id === 'pro_monthly')) process.exit(1)" "$plans_output"

for file in examples/invoice-*.json; do
  output="$(node dist/cli/index.js simulate --input "$file")"
  node -e "const data = JSON.parse(process.argv[1]); if (!data.totals || typeof data.totals.total !== 'number') process.exit(1)" "$output"
done

coupon_output="$(node dist/cli/index.js validate-coupon --code SAVE20 --input examples/invoice-coupon-stack.json)"
node -e "const data = JSON.parse(process.argv[1]); if (data.valid !== true) process.exit(1)" "$coupon_output"

refund_output="$(node dist/cli/index.js refund --invoice examples/refund-partial.json --amount 1000 --strategy proportional)"
node -e "const data = JSON.parse(process.argv[1]); if (!data.creditNote || data.creditNote.amountMinor !== 1000) process.exit(1)" "$refund_output"

audit_file="$(mktemp)"
node dist/cli/index.js simulate --input examples/invoice-basic.json --trace > "$audit_file"
audit_output="$(node dist/cli/index.js audit --invoice "$audit_file")"
rm -f "$audit_file"
node -e "const data = JSON.parse(process.argv[1]); if (!data.summary || data.summary.valid !== true) process.exit(1)" "$audit_output"

compare_output="$(node dist/cli/index.js compare --baseline examples/invoice-basic.json --candidate examples/invoice-usage.json)"
node -e "const data = JSON.parse(process.argv[1]); if (!Array.isArray(data.deltas) || data.deltas.length !== 1) process.exit(1)" "$compare_output"
