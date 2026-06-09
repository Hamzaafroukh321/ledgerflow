import { performance } from "node:perf_hooks";

import type { FastifyInstance, FastifyRequest } from "fastify";
import pino from "pino";

import type { AsyncLedgerRepository, LedgerRepository } from "../data/repository.js";

type RouteRepository = LedgerRepository | AsyncLedgerRepository;

interface ObservabilityOptions {
  repository: RouteRepository;
  enabled: boolean;
  logSink?: ((line: string) => void) | undefined;
}

interface MetricKey {
  method: string;
  route: string;
  status: string;
}

interface RequestTiming {
  startedAt: number;
}

declare module "fastify" {
  interface FastifyRequest {
    requestTiming?: RequestTiming;
  }
}

export class MetricsRegistry {
  private readonly requestCounts = new Map<string, number>();
  private readonly requestDurationSums = new Map<string, number>();
  private simulationCount = 0;
  private errorCount = 0;

  public observeRequest(labels: MetricKey, durationMs: number): void {
    const key = metricKey(labels);
    this.requestCounts.set(key, (this.requestCounts.get(key) ?? 0) + 1);
    this.requestDurationSums.set(key, (this.requestDurationSums.get(key) ?? 0) + durationMs / 1000);
    if (labels.route.endsWith("/invoices/simulate")) {
      this.simulationCount += 1;
    }
    if (Number.parseInt(labels.status, 10) >= 500) {
      this.errorCount += 1;
    }
  }

  public render(): string {
    const lines = [
      "# HELP ledgerflow_http_requests_total Total HTTP requests.",
      "# TYPE ledgerflow_http_requests_total counter"
    ];
    for (const [key, count] of this.requestCounts) {
      lines.push(`ledgerflow_http_requests_total${key} ${count}`);
    }
    lines.push(
      "# HELP ledgerflow_http_request_duration_seconds_sum Total HTTP request duration.",
      "# TYPE ledgerflow_http_request_duration_seconds_sum counter"
    );
    for (const [key, duration] of this.requestDurationSums) {
      lines.push(`ledgerflow_http_request_duration_seconds_sum${key} ${duration.toFixed(6)}`);
    }
    lines.push(
      "# HELP ledgerflow_simulations_total Total invoice simulations.",
      "# TYPE ledgerflow_simulations_total counter",
      `ledgerflow_simulations_total ${this.simulationCount}`,
      "# HELP ledgerflow_errors_total Total HTTP 5xx responses.",
      "# TYPE ledgerflow_errors_total counter",
      `ledgerflow_errors_total ${this.errorCount}`
    );
    return `${lines.join("\n")}\n`;
  }
}

export function registerObservability(
  server: FastifyInstance,
  options: ObservabilityOptions,
  metrics = new MetricsRegistry()
): MetricsRegistry {
  const logger = createLogger(options);

  server.addHook("onRequest", async (request) => {
    request.requestTiming = { startedAt: performance.now() };
  });

  server.addHook("onResponse", async (request, reply) => {
    const durationMs = performance.now() - (request.requestTiming?.startedAt ?? performance.now());
    const labels = {
      method: request.method.toUpperCase(),
      route: routeLabel(request),
      status: String(reply.statusCode)
    };
    metrics.observeRequest(labels, durationMs);
    logger.info({
      msg: "request completed",
      requestId: request.requestId,
      method: labels.method,
      route: labels.route,
      statusCode: reply.statusCode,
      durationMs: Number(durationMs.toFixed(3)),
      tenantId: request.principal?.tenantId ?? "anonymous",
      subject: request.principal?.subject ?? "anonymous"
    });
  });

  server.get("/metrics", async (_request, reply) =>
    reply.type("text/plain; version=0.0.4").send(metrics.render())
  );

  server.get("/ready", async (_request, reply) => {
    try {
      await options.repository.plans.list();
      return { status: "ready" };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return reply.status(503).send({
        error: {
          code: "not_ready",
          message,
          requestId: _request.requestId
        }
      });
    }
  });

  return metrics;
}

function createLogger(options: ObservabilityOptions): pino.Logger {
  const stream = {
    write: (line: string) => {
      if (options.logSink) {
        options.logSink(line);
        return;
      }
      if (options.enabled) {
        process.stdout.write(line);
      }
    }
  };
  return pino({ level: "info", base: null, timestamp: false }, stream);
}

function routeLabel(request: FastifyRequest): string {
  const path = request.url.split("?")[0] ?? request.url;
  const routePath = request.routeOptions.url ?? path;
  return path.startsWith("/v1/") && !routePath.startsWith("/v1/")
    ? `/v1${routePath}`
    : routePath;
}

function metricKey(labels: MetricKey): string {
  return `{method="${escapeLabel(labels.method)}",route="${escapeLabel(labels.route)}",status="${escapeLabel(labels.status)}"}`;
}

function escapeLabel(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"').replaceAll("\n", "\\n");
}
