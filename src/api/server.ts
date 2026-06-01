import Fastify, { type FastifyInstance } from "fastify";

import { defaultInvoiceEngine, type InvoiceEngine } from "../engine/InvoiceEngine.js";
import { MemoryCouponRepository, MemoryPlanRepository, MemoryUsageRepository } from "../storage/memory.js";
import type { CouponRepository, PlanRepository, UsageRepository } from "../storage/repository.js";
import { registerRoutes } from "./routes.js";

export interface ServerDeps {
  engine?: InvoiceEngine;
  plans?: PlanRepository;
  usage?: UsageRepository;
  coupons?: CouponRepository;
}

export function buildServer(deps: ServerDeps = {}): FastifyInstance {
  const server = Fastify({ logger: false });
  registerRoutes(server, {
    engine: deps.engine ?? defaultInvoiceEngine,
    plans: deps.plans ?? new MemoryPlanRepository(),
    usage: deps.usage ?? new MemoryUsageRepository(),
    coupons: deps.coupons ?? new MemoryCouponRepository()
  });
  return server;
}
