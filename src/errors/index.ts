export class AppError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class ValidationError extends AppError {
  public constructor(message = "Request validation failed", details?: unknown) {
    super("validation_error", message, 400, details);
  }
}

export class NotFoundError extends AppError {
  public constructor(message: string, details?: unknown) {
    super("not_found", message, 404, details);
  }
}

export class ConflictError extends AppError {
  public constructor(message: string, details?: unknown) {
    super("conflict", message, 409, details);
  }
}

export class PricingRuleError extends AppError {
  public constructor(message: string, details?: unknown) {
    super("pricing_rule_error", message, 422, details);
  }
}

export class CurrencyError extends AppError {
  public constructor(message: string, details?: unknown) {
    super("currency_error", message, 422, details);
  }
}

export class IdempotencyError extends AppError {
  public constructor(message: string, details?: unknown) {
    super("idempotency_conflict", message, 409, details);
  }
}

export class TaxError extends AppError {
  public constructor(message: string, details?: unknown) {
    super("tax_error", message, 422, details);
  }
}
