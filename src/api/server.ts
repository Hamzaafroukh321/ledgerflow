import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import Fastify, { type FastifyInstance, type FastifyPluginCallback } from "fastify";
import cors from "@fastify/cors";
import rateLimit, { type RateLimitPluginOptions } from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { DEFAULT_COUPONS, DEFAULT_PLANS, seedDefaultCoupons, seedDefaultPlans } from "../catalog/defaults.js";
import type { CustomerRepository } from "../customers/repository.js";
import { MemoryLedgerRepository } from "../data/memory.js";
import { PostgresLedgerRepository } from "../data/postgres.js";
import type { AsyncLedgerRepository, LedgerRepository } from "../data/repository.js";
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
import { MemoryIdempotencyStore, type IdempotencyStore } from "./idempotency.js";
import { MemoryMembershipDirectory, type MembershipDirectory } from "./memberships.js";
import { registerObservability } from "./observability.js";
import { registerRbac } from "./rbac.js";
import { registerRequestIds } from "./request-id.js";
import { registerRoutes } from "./routes.js";
import { MemorySimulationCache, type SimulationCache } from "./simulation-cache.js";

const rateLimitPlugin = rateLimit as unknown as FastifyPluginCallback<RateLimitPluginOptions>;
type RouteRepository = LedgerRepository | AsyncLedgerRepository;
type DefaultServerDeps = Required<Omit<ServerDeps, "logSink">>;

export interface ServerDeps {
  engine?: InvoiceEngine;
  repository?: RouteRepository;
  plans?: PlanRepository;
  usage?: UsageRepository;
  coupons?: CouponRepository;
  customers?: CustomerRepository;
  simulations?: SimulationRunRepository;
  memberships?: MembershipDirectory;
  idempotency?: IdempotencyStore;
  simulationCache?: SimulationCache;
  logSink?: (line: string) => void;
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
  server.after(async () => {
    await prepareRepository(defaults.repository);
    const repository = resolveRouteRepository(deps, defaults.repository);
    const simulateWithEngine = shouldUseFallbackEngine(deps);
    const engine = deps.engine ?? resolveRouteEngine(simulateWithEngine, defaults.engine, repository);
    registerRequestIds(server);
    registerObservability(server, {
      repository,
      enabled: env.LEDGERFLOW_LOGS === "1",
      logSink: deps.logSink
    });
    registerTokenAuth(server, {
      token: env.LEDGERFLOW_API_TOKEN,
      tokens: env.LEDGERFLOW_API_TOKENS,
      serveWeb,
      warnOpenMode: (message) => server.log.warn(message)
    });
    registerRbac(server);
    registerRoutes(server, {
      engine,
      repository,
      memberships: deps.memberships ?? defaults.memberships,
      idempotency: deps.idempotency ?? defaults.idempotency,
      simulationCache: deps.simulationCache ?? defaults.simulationCache,
      simulateWithEngine,
      serveWeb
    });
    void server.register(
      (scoped, _options, done) => {
        registerRoutes(scoped, {
          engine,
          repository,
          memberships: deps.memberships ?? defaults.memberships,
          idempotency: deps.idempotency ?? defaults.idempotency,
          simulationCache: deps.simulationCache ?? defaults.simulationCache,
          simulateWithEngine,
          serveWeb: false
        });
        done();
      },
      { prefix: "/v1" }
    );
    server.get("/openapi.json", async () => server.swagger());
    if (webRoot) {
      void server.register(fastifyStatic, { root: webRoot, wildcard: false });
      server.setNotFoundHandler((request, reply) => {
        const acceptsHtml = request.headers.accept?.includes("text/html") ?? false;
        if (request.method === "GET" && acceptsHtml) {
          return reply.sendFile("index.html");
        }
        return reply.code(404).send({
          error: {
            code: "not_found",
            message: "Route not found",
            requestId: request.requestId
          }
        });
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

async function closeServerDeps(deps: DefaultServerDeps): Promise<void> {
  await deps.repository.close();
}

export function createDefaultServerDeps(
  env: Record<string, string | undefined> = process.env
): DefaultServerDeps {
  const dbUrl = env.LEDGERFLOW_DB_URL;
  if (dbUrl) {
    const repository = PostgresLedgerRepository.fromUrl(dbUrl);
    return {
      engine: new InvoiceEngine(),
      repository,
      plans: repository.plans as never,
      usage: repository.usage as never,
      coupons: repository.coupons as never,
      customers: repository.customers as never,
      simulations: repository.simulations as never,
      memberships: new MemoryMembershipDirectory(),
      idempotency: new MemoryIdempotencyStore(),
      simulationCache: new MemorySimulationCache()
    };
  }

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
      simulations: repository.simulations,
      memberships: new MemoryMembershipDirectory(),
      idempotency: new MemoryIdempotencyStore(),
      simulationCache: new MemorySimulationCache()
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
    simulations: repository.simulations,
    memberships: new MemoryMembershipDirectory(),
    idempotency: new MemoryIdempotencyStore(),
    simulationCache: new MemorySimulationCache()
  };
}

function resolveRouteRepository(deps: ServerDeps, fallback: RouteRepository): RouteRepository {
  if (deps.repository) {
    return deps.repository;
  }
  const repository = {
    plans: deps.plans ?? fallback.plans,
    usage: deps.usage ?? fallback.usage,
    coupons: deps.coupons ?? fallback.coupons,
    customers: deps.customers ?? fallback.customers,
    simulations: deps.simulations ?? fallback.simulations,
    transaction: <T>(work: () => T): T => work(),
    close: () => undefined
  };
  return repository as RouteRepository;
}

function resolveRouteEngine(
  useFallback: boolean,
  fallback: InvoiceEngine,
  repository: RouteRepository
): InvoiceEngine {
  return useFallback ? fallback : new InvoiceEngine(repository.plans as never, repository.coupons as never);
}

function shouldUseFallbackEngine(deps: ServerDeps): boolean {
  const hasPartialRepositoryOverrides =
    !deps.repository &&
    (deps.plans !== undefined ||
      deps.usage !== undefined ||
      deps.coupons !== undefined ||
      deps.customers !== undefined ||
      deps.simulations !== undefined);
  return hasPartialRepositoryOverrides;
}

async function prepareRepository(repository: RouteRepository): Promise<void> {
  if (repository instanceof PostgresLedgerRepository) {
    await repository.migrateUp();
  }
  for (const plan of Object.values(DEFAULT_PLANS)) {
    if (!(await repository.plans.get(plan.id))) {
      await repository.plans.save(plan);
    }
  }
  for (const coupon of Object.values(DEFAULT_COUPONS)) {
    if (!(await repository.coupons.get(coupon.code))) {
      await repository.coupons.save(coupon);
    }
  }
}
