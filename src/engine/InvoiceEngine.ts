import { applyCredits } from "../credits/ledger.js";
import type { Coupon } from "../discounts/types.js";
import { applyDiscounts } from "../discounts/stacking.js";
import { createLineItem } from "../invoice/line-item.js";
import { traceNode } from "../invoice/trace.js";
import type { Invoice, LineItem } from "../invoice/types.js";
import type { Plan } from "../plans/types.js";
import { priceComponent } from "../plans/pricing.js";
import { prorate } from "../proration/prorate.js";
import { computeTax } from "../tax/engine.js";
import type { TaxProfile } from "../tax/types.js";
import { parseBillingContext, type BillingContext } from "./context.js";

const DEFAULT_PLANS: Record<string, Plan> = {
  pro_monthly: {
    id: "pro_monthly",
    name: "Pro monthly",
    type: "per_seat",
    currency: "USD",
    components: [
      {
        id: "pro_seats",
        name: "Pro plan",
        type: "per_seat",
        currency: "USD",
        unitAmountMinor: 1999
      },
      {
        id: "api_calls",
        name: "API usage overage",
        type: "usage",
        currency: "USD",
        unitAmountMinor: 1,
        meter: "api_calls",
        includedQuantity: 10000
      }
    ]
  },
  starter_monthly: {
    id: "starter_monthly",
    name: "Starter monthly",
    type: "flat",
    currency: "USD",
    components: [
      {
        id: "starter_base",
        name: "Starter plan",
        type: "flat",
        currency: "USD",
        unitAmountMinor: 2900
      }
    ]
  }
};

const DEFAULT_COUPONS: Record<string, Coupon> = {
  SAVE20: { code: "SAVE20", kind: "percent", value: 20, stackable: true },
  LESS500: { code: "LESS500", kind: "fixed", value: 500, stackable: true }
};

export class InvoiceEngine {
  public constructor(
    private readonly plans: Record<string, Plan> = DEFAULT_PLANS,
    private readonly coupons: Record<string, Coupon> = DEFAULT_COUPONS
  ) {}

  public simulate(input: unknown): Invoice {
    const context = parseBillingContext(input);
    const plan = this.plans[context.subscription.planId];
    if (!plan) {
      throw new Error(`Plan not found: ${context.subscription.planId}`);
    }

    const baseLineItems = this.buildBaseCharges(context, plan);
    const lineItems = this.applyUsage(context, plan, baseLineItems);
    const discountCoupons = context.coupons.map((code) => this.requireCoupon(code));
    const discountResult = applyDiscounts(lineItems, discountCoupons);

    const subtotal = lineItems.reduce((sum, item) => sum + item.amountMinor, 0);
    const discountTotal = discountResult.discounts.reduce((sum, discount) => sum + discount.amountMinor, 0);
    const preTax = applyCredits(Math.max(0, subtotal + discountTotal), context.credits, "pre_tax");
    const taxableSubtotal = Math.max(0, subtotal + discountTotal + sumApplied(preTax.applied));
    const taxLines = computeTax(
      [
        {
          id: "taxable-subtotal",
          description: "Taxable subtotal",
          amountMinor: taxableSubtotal,
          currency: context.currency
        }
      ],
      normalizeTaxProfile(context.customer.taxProfile)
    ).taxLines;
    const tax = taxLines.reduce((sum, line) => sum + line.amountMinor, 0);
    const postTax = applyCredits(taxableSubtotal + tax, preTax.remainingCredits, "post_tax");
    const creditTotal = sumApplied(preTax.applied) + sumApplied(postTax.applied);
    const total = Math.max(0, subtotal + discountTotal + creditTotal + tax);

    const explanation = traceNode({
      id: "root",
      rule: "invoice_total",
      total,
      children: [
        traceNode({ id: "subtotal", rule: "subtotal", total: subtotal }),
        traceNode({ id: "discounts", rule: "discounts", total: discountTotal }),
        traceNode({ id: "credits", rule: "credits", total: creditTotal }),
        traceNode({ id: "tax", rule: "tax", total: tax })
      ]
    });

    const invoice: Invoice = {
      currency: context.currency,
      lineItems,
      discounts: discountResult.discounts,
      creditsApplied: [...preTax.applied, ...postTax.applied],
      taxLines,
      totals: {
        subtotal,
        discountTotal,
        creditTotal,
        tax,
        total
      },
      explanation
    };
    if (context.invoiceId !== undefined) {
      invoice.id = context.invoiceId;
    }
    return invoice;
  }

  private buildBaseCharges(context: BillingContext, plan: Plan): LineItem[] {
    return plan.components
      .filter((component) => component.type !== "usage")
      .map((component) => {
        const quantity = component.type === "per_seat" ? context.subscription.seats : 1;
        const priced = priceComponent(component, quantity);
        const amount = context.subscription.changedOn
          ? prorate(priced.amount, context.period, {
              start: context.subscription.changedOn,
              end: context.period.end
            }).amount
          : priced.amount;
        return createLineItem({
          id: component.id,
          description:
            component.type === "per_seat"
              ? `${component.name} (${context.subscription.seats} seats)`
              : component.name,
          amountMinor: amount.amountMinor,
          currency: amount.currency,
          traceId: priced.trace.id
        });
      });
  }

  private applyUsage(context: BillingContext, plan: Plan, lineItems: LineItem[]): LineItem[] {
    const usageLines = plan.components
      .filter((component) => component.type === "usage")
      .map((component) => {
        const usage = context.usage.find((entry) => entry.meter === component.meter);
        const priced = priceComponent(component, usage?.quantity ?? 0);
        if (priced.amount.isZero()) {
          return undefined;
        }
        return createLineItem({
          id: component.id,
          description: component.name,
          amountMinor: priced.amount.amountMinor,
          currency: priced.amount.currency,
          traceId: priced.trace.id
        });
      })
      .filter((item): item is LineItem => item !== undefined);

    return [...lineItems, ...usageLines];
  }

  private requireCoupon(code: string): Coupon {
    const coupon = this.coupons[code];
    if (!coupon) {
      throw new Error(`Coupon not found: ${code}`);
    }
    return coupon;
  }
}

function sumApplied(credits: { amountMinor: number }[]): number {
  return credits.reduce((sum, credit) => sum + credit.amountMinor, 0);
}

function normalizeTaxProfile(profile: BillingContext["customer"]["taxProfile"]): TaxProfile {
  const normalized: TaxProfile = {
    exempt: profile.exempt,
    jurisdiction: profile.jurisdiction
  };
  if (profile.reverseCharge !== undefined) {
    normalized.reverseCharge = profile.reverseCharge;
  }
  if (profile.inclusive !== undefined) {
    normalized.inclusive = profile.inclusive;
  }
  if (profile.rates !== undefined) {
    normalized.rates = profile.rates;
  }
  return normalized;
}

export const defaultInvoiceEngine = new InvoiceEngine();
