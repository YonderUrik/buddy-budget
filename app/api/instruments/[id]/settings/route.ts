import { NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { userInstrumentSettings } from "@/lib/db/schema/investments";
import { findVisibleInstrument } from "@/lib/investments/instruments";
import { bindRequestUser, withRoute } from "@/lib/observability";
import { updateInstrumentSettingsSchema } from "@/lib/validation/investments";

const SETTINGS_COLUMNS = {
  instrumentId: userInstrumentSettings.instrumentId,
  taxRate: userInstrumentSettings.taxRate,
  taxHarmonized: userInstrumentSettings.taxHarmonized,
  couponRate: userInstrumentSettings.couponRate,
  couponFrequency: userInstrumentSettings.couponFrequency,
  maturityDate: userInstrumentSettings.maturityDate,
};

/**
 * Impostazioni fiscali (aliquota, armonizzato) e cedole (tasso, frequenza, scadenza) di uno strumento, solo per
 * l'utente che le salva: gli strumenti sono condivisi. Tutto null cancella le impostazioni (torna all'automatico).
 */
async function handlePut(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);
  const userId = session.user.id;

  const { id } = await params;
  const instrument = await findVisibleInstrument(userId, id);
  if (!instrument) return Response.json({ error: "Strumento non trovato" }, { status: 404 });

  const parsed = updateInstrumentSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0].message }, { status: 400 });
  const input = parsed.data;
  if (input.couponRate !== null && instrument.type !== "obbligazione") {
    return Response.json({ error: "Le cedole si inseriscono solo per le obbligazioni" }, { status: 400 });
  }

  const where = and(eq(userInstrumentSettings.userId, userId), eq(userInstrumentSettings.instrumentId, id));
  if (Object.values(input).every((v) => v === null)) {
    await db.delete(userInstrumentSettings).where(where);
    return Response.json({ instrumentId: id, taxRate: null, taxHarmonized: null, couponRate: null, couponFrequency: null, maturityDate: null });
  }
  const values = {
    taxRate: input.taxRate,
    taxHarmonized: input.taxHarmonized,
    couponRate: input.couponRate === null ? null : String(input.couponRate),
    couponFrequency: input.couponFrequency as 1 | 2 | 4 | null,
    maturityDate: input.maturityDate,
    updatedAt: new Date(),
  };
  const [saved] = await db
    .insert(userInstrumentSettings)
    .values({ userId, instrumentId: id, ...values })
    .onConflictDoUpdate({ target: [userInstrumentSettings.userId, userInstrumentSettings.instrumentId], set: values })
    .returning(SETTINGS_COLUMNS);
  return Response.json(saved);
}

export const PUT = withRoute("instruments.settings_update", handlePut);
