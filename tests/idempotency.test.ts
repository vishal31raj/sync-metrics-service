import { sequelize, Transaction, ProcessedWebhookEvent } from "../src/models";
import { upsertNormalizedRecord } from "../src/pipeline/upsert";
import { stripeSource } from "../src/sources/stripeSource";

beforeAll(async () => {
  await sequelize.authenticate();
});

afterAll(async () => {
  await sequelize.close();
});

beforeEach(async () => {
  await Transaction.destroy({ where: {}, truncate: true, cascade: true });
  await ProcessedWebhookEvent.destroy({
    where: {},
    truncate: true,
    cascade: true,
  });
});

const sampleCharge = {
  id: "ch_idem_test_1",
  amount: 5000,
  currency: "usd",
  status: "succeeded",
  created: Math.floor(Date.now() / 1000),
};

describe("idempotent writes", () => {
  it("re-running the same normalized upsert twice does not create a duplicate row", async () => {
    const normalized = stripeSource.normalize(sampleCharge as any);

    await upsertNormalizedRecord(normalized);
    await upsertNormalizedRecord(normalized);

    const rows = await Transaction.findAll({
      where: { source: "stripe", sourceId: "ch_idem_test_1" },
    });
    expect(rows).toHaveLength(1);
  });

  it("upsert on the same key updates fields instead of inserting a second row", async () => {
    const first = stripeSource.normalize(sampleCharge as any);
    await upsertNormalizedRecord(first);

    const updatedCharge = { ...sampleCharge, amount: 7500 };
    const second = stripeSource.normalize(updatedCharge as any);
    await upsertNormalizedRecord(second);

    const rows = await Transaction.findAll({
      where: { source: "stripe", sourceId: "ch_idem_test_1" },
    });
    expect(rows).toHaveLength(1);
    expect(Number(rows[0].amountCents)).toBe(7500);
  });

  it("a duplicate webhook delivery id is rejected before touching entity tables", async () => {
    const deliveryId = "evt_test_double_fire";
    const [, firstCreated] = await ProcessedWebhookEvent.findOrCreate({
      where: { source: "stripe", deliveryId },
      defaults: { source: "stripe", deliveryId },
    });
    const [, secondCreated] = await ProcessedWebhookEvent.findOrCreate({
      where: { source: "stripe", deliveryId },
      defaults: { source: "stripe", deliveryId },
    });

    expect(firstCreated).toBe(true);
    expect(secondCreated).toBe(false);
  });
});
