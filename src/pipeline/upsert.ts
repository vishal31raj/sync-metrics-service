import { Contact, CalendarEvent, Transaction } from "../models";
import { NormalizedRecord } from "../sources/types";

export async function upsertNormalizedRecord(
  record: NormalizedRecord,
): Promise<void> {
  const { entityType, source, sourceId, data } = record;

  switch (entityType) {
    case "contact":
      await Contact.upsert({ source, sourceId, ...data } as any, {
        conflictFields: ["source", "source_id"] as any,
      });
      return;
    case "calendar_event":
      await CalendarEvent.upsert({ source, sourceId, ...data } as any, {
        conflictFields: ["source", "source_id"] as any,
      });
      return;
    case "transaction":
      await Transaction.upsert({ source, sourceId, ...data } as any, {
        conflictFields: ["source", "source_id"] as any,
      });
      return;
    default: {
      const _exhaustive: never = entityType;
      throw new Error(`Unknown entity type: ${_exhaustive}`);
    }
  }
}
