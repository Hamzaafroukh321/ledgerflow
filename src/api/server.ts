import Fastify, { type FastifyInstance } from "fastify";

import { seedDefaultCoupons, seedDefaultPlans } from "../catalog/defaults.js";
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
    const plans = new SqlitePlanRepository(dbPath);
    const usage = new SqliteUsageRepository(dbPath);
    const coupons = new SqliteCouponRepository(dbPath);
    seedDefaultPlans(plans);
    seedDefaultCoupons(coupons);
    return {
      engine: defaultInvoiceEngine,
      plans,
      usage,
      coupons
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
    coupons
  };
}
