import { sequelize, Transaction } from "../src/models";
import {
  getRevenueTotal,
  getRevenueBreakdown,
  assertRevenueConsistency,
} from "../src/metrics/revenueQuery";
import { mapStatus } from "../src/normalize/statusMap";
import { QueryTypes } from "sequelize";

const RANGE = { startDate: "2027-01-01", endDate: "2027-02-01" };

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Transaction.destroy({ where: {}, truncate: true, cascade: true });
});

async function seed(
  rows: Array<{
    id: string;
    source: string;
    amount: number;
    status: string;
    day: string;
  }>,
) {
  for (const r of rows) {
    await Transaction.create({
      source: r.source,
      sourceId: r.id,
      amountCents: r.amount,
      currency: "usd",
      rawStatus: r.status,
      canonicalStatus: mapStatus(r.source, r.status),
      occurredAt: new Date(`${r.day}T12:00:00Z`),
      sourceUpdatedAt: new Date(),
      raw: { seed: true },
    } as any);
  }
}

describe("revenue metrics never drift between summary and breakdown", () => {
  it("agrees across multiple sources and a mix of statuses", async () => {
    await seed([
      {
        id: "t1",
        source: "stripe",
        amount: 10000,
        status: "succeeded",
        day: "2027-01-05",
      },
      {
        id: "t2",
        source: "stripe",
        amount: 2000,
        status: "pending",
        day: "2027-01-05",
      },
      {
        id: "t3",
        source: "generic_invoicing",
        amount: 30000,
        status: "paid",
        day: "2027-01-06",
      },
      {
        id: "t4",
        source: "generic_invoicing",
        amount: 5000,
        status: "void",
        day: "2027-01-07",
      },
      {
        id: "t5",
        source: "stripe",
        amount: 7500,
        status: "succeeded",
        day: "2027-01-20",
      },
    ]);

    const summary = await getRevenueTotal(RANGE);
    const breakdown = await getRevenueBreakdown(RANGE, "day");
    const breakdownSum = breakdown.reduce((s, b) => s + b.totalCents, 0);

    expect(summary.totalCents).toBe(47500);
    expect(breakdownSum).toBe(summary.totalCents);

    const consistency = await assertRevenueConsistency(RANGE);
    expect(consistency.consistent).toBe(true);
  });

  it("excludes an unrecognized status from BOTH views identically", async () => {
    await seed([
      {
        id: "t1",
        source: "stripe",
        amount: 10000,
        status: "succeeded",
        day: "2027-01-05",
      },
      {
        id: "t2",
        source: "stripe",
        amount: 999999,
        status: "some_new_status_v2",
        day: "2027-01-05",
      },
    ]);

    const summary = await getRevenueTotal(RANGE);
    const breakdown = await getRevenueBreakdown(RANGE, "day");
    const breakdownSum = breakdown.reduce((s, b) => s + b.totalCents, 0);

    expect(summary.totalCents).toBe(10000);
    expect(breakdownSum).toBe(10000);
  });

  it("would be caught if a second, ad-hoc revenue calculation disagreed", async () => {
    await seed([
      {
        id: "t1",
        source: "stripe",
        amount: 10000,
        status: "succeeded",
        day: "2027-01-05",
      },
      {
        id: "t2",
        source: "generic_invoicing",
        amount: 4000,
        status: "paid",
        day: "2027-01-06",
      },
    ]);

    const official = await getRevenueTotal(RANGE);

    const buggyExcludeList = ["pending", "failed", "voided"];
    const [buggyRow] = await sequelize.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions
       WHERE canonical_status NOT IN (:excluded)
         AND occurred_at >= :startDate AND occurred_at < :endDate`,
      {
        replacements: {
          excluded: buggyExcludeList,
          startDate: RANGE.startDate,
          endDate: RANGE.endDate,
        },
        type: QueryTypes.SELECT,
      },
    );

    expect(Number(buggyRow.total)).toBe(official.totalCents);
    await seed([
      {
        id: "t3",
        source: "stripe",
        amount: 50000,
        status: "refunded",
        day: "2027-01-07",
      },
    ]);
    const officialAfter = await getRevenueTotal(RANGE);
    const [buggyRowAfter] = await sequelize.query<{ total: string }>(
      `SELECT COALESCE(SUM(amount_cents), 0) AS total FROM transactions
       WHERE canonical_status NOT IN (:excluded)
         AND occurred_at >= :startDate AND occurred_at < :endDate`,
      {
        replacements: {
          excluded: buggyExcludeList,
          startDate: RANGE.startDate,
          endDate: RANGE.endDate,
        },
        type: QueryTypes.SELECT,
      },
    );
    expect(Number(buggyRowAfter.total)).not.toBe(officialAfter.totalCents);
  });
});
