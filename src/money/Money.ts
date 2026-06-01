import { RoundingMode, roundMinor } from "./rounding.js";

export class Money {
  public readonly amountMinor: number;
  public readonly currency: string;

  public constructor(amountMinor: number, currency: string) {
    if (!Number.isSafeInteger(amountMinor)) {
      throw new Error("Money amount must be a safe integer minor-unit value");
    }
    if (!/^[A-Z]{3}$/.test(currency)) {
      throw new Error("Currency must be an ISO 4217 uppercase code");
    }

    this.amountMinor = amountMinor;
    this.currency = currency;
  }

  public static zero(currency: string): Money {
    return new Money(0, currency);
  }

  public static fromMajor(
    value: number,
    currency: string,
    mode: RoundingMode = RoundingMode.HALF_UP
  ): Money {
    return new Money(roundMinor(value * 100, mode), currency);
  }

  public add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor + other.amountMinor, this.currency);
  }

  public subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amountMinor - other.amountMinor, this.currency);
  }

  public multiply(scalar: number, mode: RoundingMode = RoundingMode.HALF_UP): Money {
    if (!Number.isFinite(scalar)) {
      throw new Error("Money multiplier must be finite");
    }
    return new Money(roundMinor(this.amountMinor * scalar, mode), this.currency);
  }

  public negate(): Money {
    return new Money(-this.amountMinor, this.currency);
  }

  public isZero(): boolean {
    return this.amountMinor === 0;
  }

  public compare(other: Money): number {
    this.assertSameCurrency(other);
    return Math.sign(this.amountMinor - other.amountMinor);
  }

  public toJSON(): { amountMinor: number; currency: string } {
    return {
      amountMinor: this.amountMinor,
      currency: this.currency
    };
  }

  private assertSameCurrency(other: Money): void {
    if (this.currency !== other.currency) {
      throw new Error(`Currency mismatch: ${this.currency} cannot be combined with ${other.currency}`);
    }
  }
}
