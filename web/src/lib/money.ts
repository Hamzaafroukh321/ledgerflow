export function formatMinor(amountMinor: number, currency: string): string {
  assertCurrency(currency);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    currencyDisplay: "narrowSymbol"
  }).format(amountMinor / 100);
}

export function parseMajorToMinor(value: string): number {
  const normalized = value.trim().replace(/[$,\s]/g, "");
  if (!/^-?\d+(\.\d{0,2})?$/.test(normalized)) {
    throw new Error("Money value must be a decimal with at most two fractional digits");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const absoluteWhole = whole.replace("-", "");
  const cents = `${fraction}00`.slice(0, 2);
  return sign * (Number.parseInt(absoluteWhole, 10) * 100 + Number.parseInt(cents, 10));
}

export function signedMinor(amountMinor: number, currency: string): string {
  if (amountMinor === 0) {
    return formatMinor(0, currency);
  }
  const formatted = formatMinor(Math.abs(amountMinor), currency);
  return amountMinor > 0 ? `+${formatted}` : `-${formatted}`;
}

function assertCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency)) {
    throw new Error("Currency must be a three-letter uppercase ISO code");
  }
}
