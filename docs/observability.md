# Observability

LedgerFlow exposes operational signals for hosted deployments without changing the billing simulation contract.

## Logs

Set `LEDGERFLOW_LOGS=1` to emit JSON request logs to stdout. Each line includes:

- `requestId`
- `method`
- `route`
- `statusCode`
- `durationMs`
- `tenantId`
- `subject`

Send `x-request-id` with API calls when you want logs, response headers, and error envelopes to share a caller-controlled identifier.

## Metrics

`GET /metrics` returns Prometheus text format. When API authentication is configured, call it with the same bearer token or `x-ledgerflow-token` header used for API routes.

Key series:

- `ledgerflow_http_requests_total{method,route,status}`
- `ledgerflow_http_request_duration_seconds_sum{method,route,status}`
- `ledgerflow_simulations_total`
- `ledgerflow_errors_total`

Sample dashboard queries:

```promql
sum by (route, status) (rate(ledgerflow_http_requests_total[5m]))
rate(ledgerflow_simulations_total[5m])
sum(rate(ledgerflow_errors_total[5m]))
sum by (route) (rate(ledgerflow_http_request_duration_seconds_sum[5m]))
```

## Traces

LedgerFlow creates OpenTelemetry spans around repository scoping/catalog access and invoice simulation. Register an OpenTelemetry SDK in the hosting process to export spans to your collector.

Span names:

- `ledgerflow.repository.scope`
- `ledgerflow.invoice.simulate`

## Health And Readiness

`GET /health` remains a liveness check and returns `{ "status": "ok" }`.

`GET /ready` verifies repository access. It returns `{ "status": "ready" }` when the backing store responds and HTTP 503 with the standard error envelope when repository access fails.
