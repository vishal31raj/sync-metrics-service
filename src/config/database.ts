import { Sequelize } from "sequelize";
import { types as pgTypes } from "pg";
import dotenv from "dotenv";
dotenv.config();

pgTypes.setTypeParser(20, (val: string) => parseInt(val, 10));

const useSSL = process.env.DB_SSL === "true";

export const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: "postgres",
  logging: false,
  dialectOptions: useSSL
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});
