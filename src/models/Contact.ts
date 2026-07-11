import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../config/database";

export interface ContactAttributes {
  id: string;
  source: string;
  sourceId: string;
  email: string | null;
  fullName: string | null;
  company: string | null;
  lifecycleStage: string | null;
  sourceUpdatedAt: Date | null;
  raw: Record<string, unknown>;
}

type ContactCreationAttributes = Optional<ContactAttributes, "id">;

export class Contact
  extends Model<ContactAttributes, ContactCreationAttributes>
  implements ContactAttributes
{
  public id!: string;
  public source!: string;
  public sourceId!: string;
  public email!: string | null;
  public fullName!: string | null;
  public company!: string | null;
  public lifecycleStage!: string | null;
  public sourceUpdatedAt!: Date | null;
  public raw!: Record<string, unknown>;
}

Contact.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    source: { type: DataTypes.TEXT, allowNull: false },
    sourceId: { type: DataTypes.TEXT, allowNull: false, field: "source_id" },
    email: { type: DataTypes.TEXT },
    fullName: { type: DataTypes.TEXT, field: "full_name" },
    company: { type: DataTypes.TEXT },
    lifecycleStage: { type: DataTypes.TEXT, field: "lifecycle_stage" },
    sourceUpdatedAt: { type: DataTypes.DATE, field: "source_updated_at" },
    raw: { type: DataTypes.JSONB, allowNull: false },
  },
  {
    sequelize,
    tableName: "contacts",
    underscored: true,
    indexes: [{ unique: true, fields: ["source", "source_id"] }],
  },
);
