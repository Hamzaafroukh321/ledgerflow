import type { FastifyRequest } from "fastify";
import { z } from "zod";

const paginationQuerySchema = z.object({
  cursor: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});

export interface PageEnvelope<T> {
  data: T[];
  page: {
    limit: number;
    total: number;
    nextCursor: string | null;
  };
}

export function paginate<T>(items: T[], request: FastifyRequest): PageEnvelope<T> {
  const query = paginationQuerySchema.parse(request.query);
  const offset = decodeCursor(query.cursor);
  const pageItems = items.slice(offset, offset + query.limit);
  const nextOffset = offset + pageItems.length;
  return {
    data: pageItems,
    page: {
      limit: query.limit,
      total: items.length,
      nextCursor: nextOffset < items.length ? encodeCursor(nextOffset) : null
    }
  };
}

function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ offset }), "utf8").toString("base64url");
}

function decodeCursor(cursor: string | undefined): number {
  if (cursor === undefined) {
    return 0;
  }
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      offset?: unknown;
    };
    if (typeof parsed.offset === "number" && Number.isInteger(parsed.offset) && parsed.offset >= 0) {
      return parsed.offset;
    }
  } catch {
    throw new Error("Pagination cursor is invalid");
  }
  throw new Error("Pagination cursor is invalid");
}
