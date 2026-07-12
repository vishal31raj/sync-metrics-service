import express from "express";
import { metricsRouter } from "./routes/metricsRoutes";
import { syncRouter } from "./routes/syncRoutes";
import { webhookRouter } from "./routes/webhookRoutes";

export const app = express();
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/metrics", metricsRouter);
app.use("/sync", syncRouter);
app.use("/webhooks", webhookRouter);

app.use(
  (
    err: unknown,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "internal_error" });
  },
);
