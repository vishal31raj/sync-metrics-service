import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export type CanonicalTxnStatus =
  | "collected"
  | "pending"
  | "failed"
  | "refunded"
  | "voided"
  | "unknown";

export interface TransactionAttributes {
  id: string;
  source: string;
  sourceId: string;
  amountCents: number;
  currency: string;
  rawStatus: string;
  canonicalStatus: CanonicalTxnStatus;
  occurredAt: Date;
  sourceUpdatedAt: Date | null;
  raw: Record<string, unknown>;
}

type TransactionCreationAttributes = Optional<TransactionAttributes, "id">;

export class Transaction
  extends Model<TransactionAttributes, TransactionCreationAttributes>
  implements TransactionAttributes
{
  public id!: string;
  public source!: string;
  public sourceId!: string;
  public amountCents!: number;
  public currency!: string;
  public rawStatus!: string;
  public canonicalStatus!: CanonicalTxnStatus;
  public occurredAt!: Date;
  public sourceUpdatedAt!: Date | null;
  public raw!: Record<string, unknown>;
}

Transaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source: { type: DataTypes.TEXT, allowNull: false },
    sourceId: { type: DataTypes.TEXT, allowNull: false, field: "source_id" },
    amountCents: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "amount_cents",
    },
    currency: { type: DataTypes.TEXT, allowNull: false, defaultValue: "usd" },
    rawStatus: { type: DataTypes.TEXT, allowNull: false, field: "raw_status" },
    canonicalStatus: {
      type: DataTypes.ENUM(
        "collected",
        "pending",
        "failed",
        "refunded",
        "voided",
        "unknown",
      ),
      allowNull: false,
      field: "canonical_status",
    },
    occurredAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "occurred_at",
    },
    sourceUpdatedAt: { type: DataTypes.DATE, field: "source_updated_at" },
    raw: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    sequelize,
    tableName: "transactions",
    underscored: true,
    indexes: [{ unique: true, fields: ["source", "source_id"] }],
  },
);
