import { Sequelize } from "sequelize";
import { types as pgTypes } from "pg";
import dotenv from "dotenv";
dotenv.config();

pgTypes.setTypeParser(20, (val: string) => parseInt(val, 10));

export const sequelize = new Sequelize(process.env.DATABASE_URL as string, {
  dialect: "postgres",
  logging: false,
  dialectOptions: {
    ssl: {
      require: true,
      rejectUnauthorized: false,
    },
  },
});
