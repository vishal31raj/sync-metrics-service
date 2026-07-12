import dotenv from "dotenv";
dotenv.config();
import { sequelize, Transaction, Contact, CalendarEvent } from "../src/models";
import { mapStatus } from "../src/normalize/statusMap";

async function main() {
  await sequelize.authenticate();

  const stripeCharges = [
    {
      id: "ch_seed_1",
      amount: 12000,
      status: "succeeded",
      occurredAt: "2026-06-01",
    },
    {
      id: "ch_seed_2",
      amount: 4500,
      status: "pending",
      occurredAt: "2026-06-02",
    },
    {
      id: "ch_seed_3",
      amount: 9900,
      status: "failed",
      occurredAt: "2026-06-03",
    },
    {
      id: "ch_seed_4",
      amount: 15000,
      status: "succeeded",
      occurredAt: "2026-06-04",
    },
  ];
  for (const c of stripeCharges) {
    await Transaction.upsert({
      source: "stripe",
      sourceId: c.id,
      amountCents: c.amount,
      currency: "usd",
      rawStatus: c.status,
      canonicalStatus: mapStatus("stripe", c.status),
      occurredAt: new Date(c.occurredAt),
      sourceUpdatedAt: new Date(c.occurredAt),
      raw: c,
    });
  }

  const invoicingRows = [
    {
      id: "inv_seed_1",
      amount: 25000,
      status: "paid",
      occurredAt: "2026-06-01",
    },
    {
      id: "inv_seed_2",
      amount: 8000,
      status: "open",
      occurredAt: "2026-06-05",
    },
    {
      id: "inv_seed_3",
      amount: 5000,
      status: "chargeback_pending",
      occurredAt: "2026-06-06",
    },
  ];
  for (const r of invoicingRows) {
    await Transaction.upsert({
      source: "generic_invoicing",
      sourceId: r.id,
      amountCents: r.amount,
      currency: "usd",
      rawStatus: r.status,
      canonicalStatus: mapStatus("generic_invoicing", r.status),
      occurredAt: new Date(r.occurredAt),
      sourceUpdatedAt: new Date(r.occurredAt),
      raw: r,
    });
  }

  await Contact.upsert({
    source: "hubspot",
    sourceId: "contact_seed_1",
    email: "ada@example.com",
    fullName: "Ada Lovelace",
    company: "Analytical Engines Inc",
    lifecycleStage: "customer",
    sourceUpdatedAt: new Date(),
    raw: { seed: true },
  });

  await CalendarEvent.upsert({
    source: "google_calendar",
    sourceId: "event_seed_1",
    title: "Quarterly Business Review",
    startsAt: new Date("2026-06-10T15:00:00Z"),
    endsAt: new Date("2026-06-10T16:00:00Z"),
    attendeeEmails: ["ada@example.com"],
    status: "confirmed",
    sourceUpdatedAt: new Date(),
    raw: { seed: true },
  });

  console.log("Seed complete!");
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
