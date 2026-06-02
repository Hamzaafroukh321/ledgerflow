import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { seedDefaultCoupons, seedDefaultPlans } from "../catalog/defaults.js";
import { MemoryCustomerRepository } from "../customers/repository.js";
import type { CustomerRepository } from "../customers/repository.js";
import { defaultInvoiceEngine, type InvoiceEngine } from "../engine/InvoiceEngine.js";
import { registerErrorHandler } from "../errors/handler.js";
import {
  MemoryCouponRepository,
  MemoryPlanRepository,
  MemorySimulationRunRepository,
  MemoryUsageRepository
} from "../storage/memory.js";
import type {
  CouponRepository,
  PlanRepository,
  SimulationRunRepository,
  UsageRepository
} from "../storage/repository.js";
import {
  SqliteCouponRepository,
  SqliteCustomerRepository,
  SqlitePlanRepository,
  SqliteSimulationRunRepository,
  SqliteUsageRepository
} from "../storage/sqlite.js";
import { registerRoutes } from "./routes.js";

export interface ServerDeps {
  engine?: InvoiceEngine;
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
  const server = Fastify({ logger: false });
  const webRoot = resolveWebRoot(env);
  server.addHook("onClose", async () => closeServerDeps(defaults));
  void server.register(cors, { origin: true });
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
  registerRoutes(server, {
    engine: deps.engine ?? defaults.engine,
    plans: deps.plans ?? defaults.plans,
    usage: deps.usage ?? defaults.usage,
    coupons: deps.coupons ?? defaults.coupons,
    customers: deps.customers ?? defaults.customers,
    simulations: deps.simulations ?? defaults.simulations
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
  return server;
}

function resolveWebRoot(env: Record<string, string | undefined>): string | undefined {
  if (env.LEDGERFLOW_SERVE_WEB !== "1") {
    return undefined;
  }
  const root = resolve(env.LEDGERFLOW_WEB_ROOT ?? join(process.cwd(), "web", "dist"));
  return existsSync(join(root, "index.html")) ? root : undefined;
}

function closeServerDeps(deps: Required<ServerDeps>): void {
  for (const repository of [
    deps.plans,
    deps.usage,
    deps.coupons,
    deps.customers,
    deps.simulations
  ]) {
    if ("close" in repository && typeof repository.close === "function") {
      repository.close();
    }
  }
}

export function createDefaultServerDeps(
  env: Record<string, string | undefined> = process.env
): Required<ServerDeps> {
  const dbPath = env.LEDGERFLOW_DB;
  if (dbPath) {
    const plans = new SqlitePlanRepository(dbPath);
    const usage = new SqliteUsageRepository(dbPath);
    const coupons = new SqliteCouponRepository(dbPath);
    const simulations = new SqliteSimulationRunRepository(dbPath);
    seedDefaultPlans(plans);
    seedDefaultCoupons(coupons);
    return {
      engine: defaultInvoiceEngine,
      plans,
      usage,
      coupons,
      customers: new SqliteCustomerRepository(dbPath),
      simulations
    };
  }

  const plans = new MemoryPlanRepository();
  const usage = new MemoryUsageRepository();
  const coupons = new MemoryCouponRepository();
  const simulations = new MemorySimulationRunRepository();
  seedDefaultPlans(plans);
  seedDefaultCoupons(coupons);
  return {
    engine: defaultInvoiceEngine,
    plans,
    usage,
    coupons,
    customers: new MemoryCustomerRepository(),
    simulations
  };
}
