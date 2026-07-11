import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface CalendarEventAttributes {
  id: string;
  source: string;
  sourceId: string;
  title: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
  attendeeEmails: string[];
  status: string | null;
  sourceUpdatedAt: Date | null;
  raw: Record<string, unknown>;
}

type CalendarEventCreationAttributes = Optional<CalendarEventAttributes, "id">;

export class CalendarEvent
  extends Model<CalendarEventAttributes, CalendarEventCreationAttributes>
  implements CalendarEventAttributes
{
  public id!: string;
  public source!: string;
  public sourceId!: string;
  public title!: string | null;
  public startsAt!: Date | null;
  public endsAt!: Date | null;
  public attendeeEmails!: string[];
  public status!: string | null;
  public sourceUpdatedAt!: Date | null;
  public raw!: Record<string, unknown>;
}

CalendarEvent.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source: { type: DataTypes.TEXT, allowNull: false },
    sourceId: { type: DataTypes.TEXT, allowNull: false, field: "source_id" },
    title: { type: DataTypes.TEXT },
    startsAt: { type: DataTypes.DATE, field: "starts_at" },
    endsAt: { type: DataTypes.DATE, field: "ends_at" },
    attendeeEmails: {
      type: DataTypes.ARRAY(DataTypes.TEXT),
      field: "attendee_emails",
      defaultValue: [],
    },
    status: { type: DataTypes.TEXT },
    sourceUpdatedAt: { type: DataTypes.DATE, field: "source_updated_at" },
    raw: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    sequelize,
    tableName: "calendar_events",
    underscored: true,
    indexes: [{ unique: true, fields: ["source", "source_id"] }],
  },
);
