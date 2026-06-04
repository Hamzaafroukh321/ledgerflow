import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import Fastify, { type FastifyInstance, type FastifyPluginCallback } from "fastify";
import cors from "@fastify/cors";
import rateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { seedDefaultCoupons, seedDefaultPlans } from "../catalog/defaults.js";
import type { CustomerRepository } from "../customers/repository.js";
import { MemoryLedgerRepository } from "../data/memory.js";
import type { LedgerRepository } from "../data/repository.js";
import { SqliteLedgerRepository } from "../data/sqlite.js";
import { InvoiceEngine } from "../engine/InvoiceEngine.js";
import { registerErrorHandler } from "../errors/handler.js";
import type {
  CouponRepository,
  PlanRepository,
  SimulationRunRepository,
  UsageRepository
} from "../storage/repository.js";
import { registerTokenAuth } from "./auth.js";
import { registerRoutes } from "./routes.js";

const rateLimitPlugin = rateLimit as unknown as FastifyPluginCallback<RateLimitPluginOptions>;

export interface ServerDeps {
  engine?: InvoiceEngine;
  repository?: LedgerRepository;
  plans?: PlanRepository;
  usage?: UsageRepository;
  coupons?: CouponRepository;
  customers?: CustomerRepository;
  simulations?: SimulationRunRepository;
}

export function buildServer(
  deps: ServerDeps = {},
  env: Record<string, string | undefined> = process.env
): FastifyInstance {
  const defaults = createDefaultServerDeps(env);
  const server = Fastify({
    logger: false,
    bodyLimit: readPositiveInt(env.LEDGERFLOW_BODY_LIMIT_BYTES, 1048576)
  });
  const webRoot = resolveWebRoot(env);
  const serveWeb = webRoot !== undefined;
  server.addHook("onClose", async () => closeServerDeps(defaults));
  void server.register(cors, { origin: true });
  void server.register(rateLimitPlugin, {
    global: true,
    max: readPositiveInt(env.LEDGERFLOW_RATE_LIMIT_MAX, 300),
    timeWindow: env.LEDGERFLOW_RATE_LIMIT_WINDOW ?? "1 minute"
  });
  void server.register(swagger, {
    openapi: {
      info: {
        title: "LedgerFlow API",
        description: "Deterministic billing simulation and invoice operations API.",
        version: "0.1.0"
      }
    }
  });
  void server.register(swaggerUi, { routePrefix: "/docs" });
  registerErrorHandler(server);
  server.after(() => {
    const repository = resolveRouteRepository(deps, defaults.repository);
    const engine = deps.engine ?? resolveRouteEngine(deps, defaults.engine, repository);
    registerTokenAuth(server, {
      token: env.LEDGERFLOW_API_TOKEN,
      serveWeb,
      warnOpenMode: (message) => server.log.warn(message)
    });
    registerRoutes(server, {
      engine,
      repository,
      serveWeb
    });
    server.get("/openapi.json", async () => server.swagger());
    if (webRoot) {
      void server.register(fastifyStatic, { root: webRoot, wildcard: false });
      server.setNotFoundHandler((request, reply) => {
        const acceptsHtml = request.headers.accept?.includes("text/html") ?? false;
        if (request.method === "GET" && acceptsHtml) {
          return reply.sendFile("index.html");
        }
        return reply.code(404).send({ error: { code: "not_found", message: "Route not found" } });
      });
    }
  });
  return server;
}

function resolveWebRoot(env: Record<string, string | undefined>): string | undefined {
  if (env.LEDGERFLOW_SERVE_WEB !== "1") {
    return undefined;
  }
  const root = resolve(env.LEDGERFLOW_WEB_ROOT ?? join(process.cwd(), "web", "dist"));
  return existsSync(join(root, "index.html")) ? root : undefined;
}

function readPositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function closeServerDeps(deps: Required<ServerDeps>): void {
  deps.repository.close();
}

export function createDefaultServerDeps(
  env: Record<string, string | undefined> = process.env
): Required<ServerDeps> {
  const dbPath = env.LEDGERFLOW_DB;
  if (dbPath) {
    const repository = new SqliteLedgerRepository(dbPath);
    seedDefaultPlans(repository.plans);
    seedDefaultCoupons(repository.coupons);
    return {
      engine: new InvoiceEngine(repository.plans, repository.coupons),
      repository,
      plans: repository.plans,
      usage: repository.usage,
      coupons: repository.coupons,
      customers: repository.customers,
      simulations: repository.simulations
    };
  }

  const repository = new MemoryLedgerRepository();
  seedDefaultPlans(repository.plans);
  seedDefaultCoupons(repository.coupons);
  return {
    engine: new InvoiceEngine(repository.plans, repository.coupons),
    repository,
    plans: repository.plans,
    usage: repository.usage,
    coupons: repository.coupons,
    customers: repository.customers,
    simulations: repository.simulations
  };
}

function resolveRouteRepository(deps: ServerDeps, fallback: LedgerRepository): LedgerRepository {
  if (deps.repository) {
    return deps.repository;
  }
  return {
    plans: deps.plans ?? fallback.plans,
    usage: deps.usage ?? fallback.usage,
    coupons: deps.coupons ?? fallback.coupons,
    customers: deps.customers ?? fallback.customers,
    simulations: deps.simulations ?? fallback.simulations,
    transaction: (work) => work(),
    close: () => undefined
  };
}

function resolveRouteEngine(
  deps: ServerDeps,
  fallback: InvoiceEngine,
  repository: LedgerRepository
): InvoiceEngine {
  const hasPartialRepositoryOverrides =
    !deps.repository &&
    (deps.plans !== undefined ||
      deps.usage !== undefined ||
      deps.coupons !== undefined ||
      deps.customers !== undefined ||
      deps.simulations !== undefined);
  return hasPartialRepositoryOverrides
    ? fallback
    : new InvoiceEngine(repository.plans, repository.coupons);
}
