import dotenv from "dotenv";
dotenv.config();

import { app } from "./app";
import { sequelize } from "./config/database";

const PORT = process.env.PORT || 3000;

async function main() {
  await sequelize.authenticate();
  app.listen(PORT, () => {
    console.log(`sync-metrics-service listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
