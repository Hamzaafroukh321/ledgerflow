export function classifyDelta(delta: number): "positive" | "negative" | "neutral" {
  if (delta > 0) {
    return "positive";
  }
  if (delta < 0) {
    return "negative";
  }
  return "neutral";
}
