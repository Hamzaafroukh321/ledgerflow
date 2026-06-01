export const pipelineStages = [
  "buildBaseCharges",
  "applyProration",
  "applyUsage",
  "applyDiscounts",
  "applyCreditsPreTax",
  "computeTax",
  "applyCreditsPostTax",
  "finalize"
] as const;

export type PipelineStage = (typeof pipelineStages)[number];
