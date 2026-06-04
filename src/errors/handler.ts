import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { AppError } from "./index.js";

export function registerErrorHandler(server: FastifyInstance): void {
  server.setErrorHandler((error, request, reply) => {
    if (error instanceof z.ZodError) {
      void reply.status(400).send({
        error: {
          code: "validation_error",
          message: "Request validation failed",
          details: error.issues,
          requestId: request.requestId
        }
      });
      return;
    }
    if (error instanceof AppError) {
      const envelope: {
        error: { code: string; message: string; requestId: string; details?: unknown };
      } = {
        error: { code: error.code, message: error.message, requestId: request.requestId }
      };
      if (error.details !== undefined) {
        envelope.error.details = error.details;
      }
      void reply.status(error.status).send(envelope);
      return;
    }
    if (hasHttpStatus(error)) {
      void reply.status(error.statusCode).send({
        error: { code: "request_error", message: error.message, requestId: request.requestId }
      });
      return;
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
      void reply.status(404).send({
        error: { code: "not_found", message: error.message, requestId: request.requestId }
      });
      return;
    }
    if (error instanceof Error && /invalid|requires|must|cannot/i.test(error.message)) {
      void reply.status(400).send({
        error: { code: "domain_error", message: error.message, requestId: request.requestId }
      });
      return;
    }
    void reply.status(500).send({
      error: {
        code: "internal_error",
        message: error instanceof Error ? error.message : String(error),
        requestId: request.requestId
      }
    });
  });
}

function hasHttpStatus(error: unknown): error is Error & { statusCode: number } {
  return error instanceof Error
    && "statusCode" in error
    && typeof (error as { statusCode: unknown }).statusCode === "number";
}
