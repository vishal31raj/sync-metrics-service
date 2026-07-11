import { Router, Request, Response } from "express";
import { z } from "zod";
import {
  getRevenueTotal,
  getRevenueBreakdown,
  assertRevenueConsistency,
  BreakdownGranularity,
} from "../metrics/revenueQuery";

export const metricsRouter = Router();

const RangeSchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "startDate must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "endDate must be YYYY-MM-DD"),
  currency: z.string().optional(),
});

// GET /metrics/revenue/summary?startDate=2026-01-01&endDate=2026-02-01
metricsRouter.get("/revenue/summary", async (req: Request, res: Response) => {
  const parsed = RangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { startDate, endDate, currency } = parsed.data;
  const total = await getRevenueTotal({ startDate, endDate }, currency ?? "usd");
  res.json({ startDate, endDate, ...total });
});

// GET /metrics/revenue/breakdown?startDate=...&endDate=...&granularity=day
metricsRouter.get("/revenue/breakdown", async (req: Request, res: Response) => {
  const parsed = RangeSchema.extend({
    granularity: z.enum(["day", "week"]).optional(),
  }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { startDate, endDate, currency, granularity } = parsed.data;
  const buckets = await getRevenueBreakdown(
    { startDate, endDate },
    (granularity ?? "day") as BreakdownGranularity,
    currency ?? "usd"
  );
  res.json({ startDate, endDate, granularity: granularity ?? "day", buckets });
});

// GET /metrics/revenue/consistency-check?startDate=...&endDate=...
// Dev/ops utility: proves the two views above agree. Returns 500 if they
// don't, so this can be wired into a monitor/alert.
metricsRouter.get("/revenue/consistency-check", async (req: Request, res: Response) => {
  const parsed = RangeSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const { startDate, endDate, currency } = parsed.data;
  const result = await assertRevenueConsistency({ startDate, endDate }, currency ?? "usd");
  res.status(result.consistent ? 200 : 500).json(result);
});
