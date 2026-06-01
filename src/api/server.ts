import Fastify, { type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";

import { seedDefaultCoupons, seedDefaultPlans } from "../catalog/defaults.js";
import { MemoryCustomerRepository } from "../customers/repository.js";
import type { CustomerRepository } from "../customers/repository.js";
import { defaultInvoiceEngine, type InvoiceEngine } from "../engine/InvoiceEngine.js";
import { registerErrorHandler } from "../errors/handler.js";
import { MemoryCouponRepository, MemoryPlanRepository, MemoryUsageRepository } from "../storage/memory.js";
import type { CouponRepository, PlanRepository, UsageRepository } from "../storage/repository.js";
import {
  SqliteCouponRepository,
  SqlitePlanRepository,
  SqliteUsageRepository
} from "../storage/sqlite.js";
import { registerRoutes } from "./routes.js";

export interface ServerDeps {
  engine?: InvoiceEngine;
  plans?: PlanRepository;
  usage?: UsageRepository;
  coupons?: CouponRepository;
  customers?: CustomerRepository;
}

export function buildServer(deps: ServerDeps = {}): FastifyInstance {
  const defaults = createDefaultServerDeps();
  const server = Fastify({ logger: false });
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
    customers: deps.customers ?? defaults.customers
  });
  server.get("/openapi.json", async () => server.swagger());
  return server;
}

export function createDefaultServerDeps(
  env: Record<string, string | undefined> = process.env
): Required<ServerDeps> {
  const dbPath = env.LEDGERFLOW_DB;
  if (dbPath) {
    const plans = new SqlitePlanRepository(dbPath);
    const usage = new SqliteUsageRepository(dbPath);
    const coupons = new SqliteCouponRepository(dbPath);
    seedDefaultPlans(plans);
    seedDefaultCoupons(coupons);
    return {
      engine: defaultInvoiceEngine,
      plans,
      usage,
      coupons,
      customers: new MemoryCustomerRepository()
    };
  }

  const plans = new MemoryPlanRepository();
  const usage = new MemoryUsageRepository();
  const coupons = new MemoryCouponRepository();
  seedDefaultPlans(plans);
  seedDefaultCoupons(coupons);
  return {
    engine: defaultInvoiceEngine,
    plans,
    usage,
    coupons,
    customers: new MemoryCustomerRepository()
  };
}
