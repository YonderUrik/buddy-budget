import { customType } from "drizzle-orm/pg-core";
import { openFromDb, sealForDb } from "../../crypto/field-encryption";

/**
 * Colonna `text` cifrata a livello applicativo (vedi `lib/crypto/field-encryption.ts`). Nel database resta `text`, quindi
 * nessuna migration: le righe vecchie in chiaro si leggono come prima, le nuove si scrivono cifrate se c'è la chiave.
 * Da non usare su colonne filtrate, ordinate o raggruppate in SQL.
 */
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType() {
    return "text";
  },
  toDriver(value) {
    return sealForDb(value);
  },
  fromDriver(value) {
    return openFromDb(value);
  },
});
