import { CanonicalTxnStatus } from "../models/Transaction";

const SOURCE_STATUS_MAPS: Record<string, Record<string, CanonicalTxnStatus>> = {
  stripe: {
    succeeded: "collected",
    pending: "pending",
    failed: "failed",
    refunded: "refunded",
    canceled: "voided",
  },
  hubspot_payments: {
    completed: "collected",
    processing: "pending",
    declined: "failed",
    refunded: "refunded",
    cancelled: "voided",
  },
  generic_invoicing: {
    paid: "collected",
    open: "pending",
    uncollectible: "failed",
    void: "voided",
    refunded: "refunded",
  },
};

export function mapStatus(
  source: string,
  rawStatus: string,
): CanonicalTxnStatus {
  const table = SOURCE_STATUS_MAPS[source];
  const normalizedKey = rawStatus.trim().toLowerCase();
  const mapped = table?.[normalizedKey];

  if (!mapped) {
    logUnknownStatus(source, rawStatus);
    return "unknown";
  }
  return mapped;
}

export const COLLECTED_STATUSES: readonly CanonicalTxnStatus[] = [
  "collected",
] as const;

function logUnknownStatus(source: string, rawStatus: string): void {
  console.warn(
    `[statusMap] Unrecognized status "${rawStatus}" from source "${source}". `,
  );
}
