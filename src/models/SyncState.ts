import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

// ---------- SyncCursor: one row per source, tracks where incremental fetch left off ----------

export interface SyncCursorAttributes {
  source: string;
  cursorValue: string | null;
}

export class SyncCursor
  extends Model<SyncCursorAttributes>
  implements SyncCursorAttributes
{
  public source!: string;
  public cursorValue!: string | null;
}

SyncCursor.init(
  {
    source: { type: DataTypes.TEXT, primaryKey: true },
    cursorValue: { type: DataTypes.TEXT, field: "cursor_value" },
  },
  {
    sequelize,
    tableName: "sync_cursors",
    underscored: true,
    timestamps: true,
    updatedAt: "updated_at",
    createdAt: false,
  },
);

// ---------- SyncRun: audit log, one row per sync attempt per source ----------

export type SyncRunStatus = "success" | "partial" | "failed";
export type SyncRunMode = "incremental" | "full_backfill";

export interface SyncRunAttributes {
  id: string;
  source: string;
  mode: SyncRunMode;
  status: SyncRunStatus;
  recordsSeen: number;
  recordsWritten: number;
  recordsFailed: number;
  errorMessage: string | null;
  startedAt: Date;
  finishedAt: Date | null;
}

type SyncRunCreationAttributes = Optional<
  SyncRunAttributes,
  | "id"
  | "recordsSeen"
  | "recordsWritten"
  | "recordsFailed"
  | "errorMessage"
  | "finishedAt"
  | "startedAt"
>;

export class SyncRun
  extends Model<SyncRunAttributes, SyncRunCreationAttributes>
  implements SyncRunAttributes
{
  public id!: string;
  public source!: string;
  public mode!: SyncRunMode;
  public status!: SyncRunStatus;
  public recordsSeen!: number;
  public recordsWritten!: number;
  public recordsFailed!: number;
  public errorMessage!: string | null;
  public startedAt!: Date;
  public finishedAt!: Date | null;
}

SyncRun.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source: { type: DataTypes.TEXT, allowNull: false },
    mode: { type: DataTypes.TEXT, allowNull: false },
    status: {
      type: DataTypes.ENUM("success", "partial", "failed"),
      allowNull: false,
    },
    recordsSeen: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "records_seen",
    },
    recordsWritten: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "records_written",
    },
    recordsFailed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      field: "records_failed",
    },
    errorMessage: { type: DataTypes.TEXT, field: "error_message" },
    startedAt: {
      type: DataTypes.DATE,
      field: "started_at",
      defaultValue: DataTypes.NOW,
    },
    finishedAt: { type: DataTypes.DATE, field: "finished_at" },
  },
  { sequelize, tableName: "sync_runs", underscored: true, timestamps: false },
);

// ---------- ProcessedWebhookEvent: de-dupes webhook deliveries ----------

export interface ProcessedWebhookEventAttributes {
  source: string;
  deliveryId: string;
}

export class ProcessedWebhookEvent
  extends Model<ProcessedWebhookEventAttributes>
  implements ProcessedWebhookEventAttributes
{
  public source!: string;
  public deliveryId!: string;
}

ProcessedWebhookEvent.init(
  {
    source: { type: DataTypes.TEXT, primaryKey: true },
    deliveryId: {
      type: DataTypes.TEXT,
      primaryKey: true,
      field: "delivery_id",
    },
  },
  {
    sequelize,
    tableName: "processed_webhook_events",
    underscored: true,
    timestamps: true,
    createdAt: "received_at",
    updatedAt: false,
  },
);
