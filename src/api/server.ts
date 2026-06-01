import Fastify, { type FastifyInstance } from "fastify";

import { defaultInvoiceEngine, type InvoiceEngine } from "../engine/InvoiceEngine.js";
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
}

export function buildServer(deps: ServerDeps = {}): FastifyInstance {
  const defaults = createDefaultServerDeps();
  const server = Fastify({ logger: false });
  registerRoutes(server, {
    engine: deps.engine ?? defaults.engine,
    plans: deps.plans ?? defaults.plans,
    usage: deps.usage ?? defaults.usage,
    coupons: deps.coupons ?? defaults.coupons
  });
  return server;
}

export function createDefaultServerDeps(
  env: Record<string, string | undefined> = process.env
): Required<ServerDeps> {
  const dbPath = env.LEDGERFLOW_DB;
  if (dbPath) {
    return {
      engine: defaultInvoiceEngine,
      plans: new SqlitePlanRepository(dbPath),
      usage: new SqliteUsageRepository(dbPath),
      coupons: new SqliteCouponRepository(dbPath)
    };
  }

  return {
    engine: defaultInvoiceEngine,
    plans: new MemoryPlanRepository(),
    usage: new MemoryUsageRepository(),
    coupons: new MemoryCouponRepository()
  };
}
