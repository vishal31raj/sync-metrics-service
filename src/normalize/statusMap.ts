import { CanonicalTxnStatus } from "../models/Transaction";

/**
 * One map per source, translating that source's own status vocabulary into
 * the canonical set. This is the ONLY place raw status strings are
 * interpreted -- ingestion calls mapStatus() once per record and stores the
 * result in transactions.canonical_status. Nothing downstream (the metrics
 * service included) ever looks at raw_status to decide what counts as
 * revenue; raw_status is kept purely for audit/debugging.
 *
 * Deliberately an ALLOW-list: every source map below is exhaustive for the
 * statuses we've seen. Anything not explicitly listed maps to 'unknown'
 * rather than being guessed at -- see the fallback at the bottom. That
 * means a brand-new status value from a source (or a typo, or a future
 * Stripe API addition) can NEVER silently count as collected revenue; it
 * shows up as 'unknown' and gets flagged (see logUnknownStatus).
 */

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

/**
 * The set of canonical statuses that count as "money actually collected".
 * This is the allow-list referenced everywhere else in the metrics layer.
 * It is intentionally small and explicit -- adding a new canonical status
 * anywhere else does NOT automatically start counting as revenue; someone
 * has to deliberately add it here.
 */
export const COLLECTED_STATUSES: readonly CanonicalTxnStatus[] = [
  "collected",
] as const;

function logUnknownStatus(source: string, rawStatus: string): void {
  // In production this should page/alert, not just log -- an unknown status
  // means either a new status vocabulary value from the source (revenue
  // undercount risk if it should have been "collected") or bad data.
  // eslint-disable-next-line no-console
  console.warn(
    `[statusMap] Unrecognized status "${rawStatus}" from source "${source}". ` +
      `Mapped to 'unknown' and EXCLUDED from revenue by default (allow-list, not exclude-list). ` +
      `Add an explicit mapping in src/normalize/statusMap.ts once you've confirmed how it should count.`,
  );
}
