export interface UsageEvent {
  idempotencyKey: string;
  meter: string;
  quantity: number;
  timestamp: string;
  customerId: string;
}

export interface UsagePeriod {
  start: string;
  end: string;
}

export interface UsageIngestResult {
  accepted: boolean;
  reason?: string;
  existingEvent?: UsageEvent;
}
