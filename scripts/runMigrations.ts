import dotenv from "dotenv";
dotenv.config();
import fs from "fs";
import path from "path";
import { sequelize } from "../src/config/database";

async function main() {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), "utf-8");
    await sequelize.query(sql);
  }

  console.log("Migrations complete.");
  await sequelize.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
