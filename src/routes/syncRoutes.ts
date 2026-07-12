import { Router, Request, Response } from "express";
import { runFullSync } from "../pipeline/syncOrchestrator";
import { hubspotSource } from "../sources/hubspotSource";
import { googleCalendarSource } from "../sources/googleCalendarSource";
import { stripeSource } from "../sources/stripeSource";
import { SyncRun } from "../models";

export const syncRouter = Router();

syncRouter.post("/run", async (_req: Request, res: Response) => {
  const summaries = await runFullSync([
    hubspotSource as any,
    googleCalendarSource as any,
    stripeSource as any,
  ]);
  res.json({ summaries });
});

syncRouter.get("/runs", async (_req: Request, res: Response) => {
  const runs = await SyncRun.findAll({
    order: [["startedAt", "DESC"]],
    limit: 50,
  });
  res.json({ runs });
});
