import { SpanStatusCode, trace } from "@opentelemetry/api";

export async function withSpan<T>(name: string, work: () => Promise<T>): Promise<T> {
  const tracer = trace.getTracer("ledgerflow");
  return await tracer.startActiveSpan(name, async (span) => {
    try {
      const result = await work();
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.recordException(error as Error);
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : String(error)
      });
      throw error;
    } finally {
      span.end();
    }
  });
}
