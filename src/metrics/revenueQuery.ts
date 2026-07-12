import { QueryTypes } from "sequelize";
import { sequelize } from "../config/database";

export type BreakdownGranularity = "day" | "week";

export interface DateRange {
  startDate: string; // 'YYYY-MM-DD'
  endDate: string; // 'YYYY-MM-DD'
}

export interface RevenueTotal {
  totalCents: number;
  currency: string;
  transactionCount: number;
}

export interface RevenueBucket extends RevenueTotal {
  periodStart: string;
}

export async function getRevenueTotal(
  range: DateRange,
  currency = "usd",
): Promise<RevenueTotal> {
  const rows = await sequelize.query<{
    total_cents: string | null;
    txn_count: string;
  }>(
    `
    SELECT
      COALESCE(SUM(amount_cents), 0) AS total_cents,
      COUNT(*) AS txn_count
    FROM collected_transactions
    WHERE occurred_at >= :startDate
      AND occurred_at <  :endDate
      AND currency = :currency
    `,
    {
      replacements: {
        startDate: range.startDate,
        endDate: range.endDate,
        currency,
      },
      type: QueryTypes.SELECT,
    },
  );

  const row = rows[0];
  return {
    totalCents: Number(row?.total_cents ?? 0),
    transactionCount: Number(row?.txn_count ?? 0),
    currency,
  };
}

export async function getRevenueBreakdown(
  range: DateRange,
  granularity: BreakdownGranularity = "day",
  currency = "usd",
): Promise<RevenueBucket[]> {
  const truncUnit = granularity === "week" ? "week" : "day";

  const rows = await sequelize.query<{
    period_start: string;
    total_cents: string | null;
    txn_count: string;
  }>(
    `
    SELECT
      date_trunc(:truncUnit, occurred_at) AS period_start,
      COALESCE(SUM(amount_cents), 0) AS total_cents,
      COUNT(*) AS txn_count
    FROM collected_transactions
    WHERE occurred_at >= :startDate
      AND occurred_at <  :endDate
      AND currency = :currency
    GROUP BY period_start
    ORDER BY period_start ASC
    `,
    {
      replacements: {
        startDate: range.startDate,
        endDate: range.endDate,
        currency,
        truncUnit,
      },
      type: QueryTypes.SELECT,
    },
  );

  return rows.map((r) => ({
    periodStart: r.period_start,
    totalCents: Number(r.total_cents ?? 0),
    transactionCount: Number(r.txn_count ?? 0),
    currency,
  }));
}

export async function assertRevenueConsistency(
  range: DateRange,
  currency = "usd",
): Promise<{
  consistent: boolean;
  summaryTotalCents: number;
  breakdownSummedCents: number;
}> {
  const [summary, breakdown] = await Promise.all([
    getRevenueTotal(range, currency),
    getRevenueBreakdown(range, "day", currency),
  ]);
  const breakdownSummedCents = breakdown.reduce(
    (sum, b) => sum + b.totalCents,
    0,
  );
  return {
    consistent: summary.totalCents === breakdownSummedCents,
    summaryTotalCents: summary.totalCents,
    breakdownSummedCents,
  };
}
