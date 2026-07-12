import dotenv from "dotenv";
dotenv.config();
import { sequelize } from "../src/models";
import { runFullSync } from "../src/pipeline/syncOrchestrator";
import { hubspotSource } from "../src/sources/hubspotSource";
import { googleCalendarSource } from "../src/sources/googleCalendarSource";
import { stripeSource } from "../src/sources/stripeSource";

async function main() {
  await sequelize.authenticate();
  const summaries = await runFullSync([
    hubspotSource as any,
    googleCalendarSource as any,
    stripeSource as any,
  ]);
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
