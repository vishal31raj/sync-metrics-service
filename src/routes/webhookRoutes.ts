import { Router, Request, Response } from "express";
import { ProcessedWebhookEvent } from "../models";
import { upsertNormalizedRecord } from "../pipeline/upsert";
import { hubspotSource, HubSpotContact } from "../sources/hubspotSource";
import { stripeSource, StripeCharge } from "../sources/stripeSource";

export const webhookRouter = Router();

/**
 * Generic pattern used by both webhook endpoints below: a webhook delivery
 * carries its own unique id (Stripe: event.id, HubSpot: subscription
 * eventId). We record that id in processed_webhook_events (source,
 * delivery_id) PRIMARY KEY before doing any writes. If the same delivery
 * arrives twice -- Stripe and HubSpot both explicitly document "at least
 * once" delivery -- the second attempt hits the unique-constraint violation
 * and short-circuits before touching the entity tables.
 *
 * This is deliberately *on top of* the (source, source_id) upsert key on
 * the entity tables, not instead of it: even if this dedup table were
 * skipped, replaying the same payload would still just re-upsert the same
 * row, not duplicate it. Two independent layers of idempotency.
 */
async function alreadyProcessed(source: string, deliveryId: string): Promise<boolean> {
  const [, created] = await ProcessedWebhookEvent.findOrCreate({
    where: { source, deliveryId },
    defaults: { source, deliveryId },
  });
  return !created; // created === false means the row already existed
}

webhookRouter.post("/stripe", async (req: Request, res: Response) => {
  const event = req.body as { id?: string; type?: string; data?: { object?: unknown } };
  if (!event?.id) return res.status(400).json({ error: "missing event id" });

  if (await alreadyProcessed("stripe", event.id)) {
    return res.status(200).json({ status: "duplicate_ignored" });
  }

  try {
    const charge = event.data?.object as StripeCharge;
    if (event.type === "charge.succeeded" || event.type === "charge.updated") {
      const normalized = stripeSource.normalize(charge);
      await upsertNormalizedRecord(normalized);
    }
    res.status(200).json({ status: "processed" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

webhookRouter.post("/hubspot", async (req: Request, res: Response) => {
  const events = Array.isArray(req.body) ? req.body : [req.body];

  for (const evt of events) {
    const deliveryId = String(evt?.eventId ?? evt?.subscriptionId ?? "");
    if (!deliveryId) continue;
    if (await alreadyProcessed("hubspot", deliveryId)) continue;

    if (evt?.objectType === "CONTACT" && evt?.propertyValue) {
      const normalized = hubspotSource.normalize(evt.propertyValue as HubSpotContact);
      await upsertNormalizedRecord(normalized);
    }
  }

  res.status(200).json({ status: "processed" });
});
