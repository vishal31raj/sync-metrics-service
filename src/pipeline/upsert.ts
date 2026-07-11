import { Contact, CalendarEvent, Transaction } from "../models";
import { NormalizedRecord } from "../sources/types";

/**
 * Writes one normalized record using Postgres upsert (INSERT ... ON
 * CONFLICT (source, source_id) DO UPDATE). This is what makes re-running
 * the same sync, or replaying the same webhook twice, safe: the unique
 * constraint on (source, source_id) means a second write with identical
 * keys updates the existing row in place rather than inserting a
 * duplicate. Sequelize's `upsert()` compiles to exactly that.
 */
export async function upsertNormalizedRecord(record: NormalizedRecord): Promise<void> {
  const { entityType, source, sourceId, data } = record;

  switch (entityType) {
    case "contact":
      await Contact.upsert(
        { source, sourceId, ...data } as any,
        { conflictFields: ["source", "source_id"] as any }
      );
      return;
    case "calendar_event":
      await CalendarEvent.upsert(
        { source, sourceId, ...data } as any,
        { conflictFields: ["source", "source_id"] as any }
      );
      return;
    case "transaction":
      await Transaction.upsert(
        { source, sourceId, ...data } as any,
        { conflictFields: ["source", "source_id"] as any }
      );
      return;
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }
}
