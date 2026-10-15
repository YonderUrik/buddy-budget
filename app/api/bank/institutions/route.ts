import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { BankProviderError } from "@/lib/bank-data/provider";
import { getBankProvider, providerForNewConnections } from "@/lib/bank-data/providers";
import { bindRequestUser, requestLogger, withRoute } from "@/lib/observability";

const COUNTRY_FORMAT = /^[A-Z]{2}$/;

/** Banche collegabili in un paese, dal fornitore dei collegamenti nuovi. */
async function handleGet(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });
  bindRequestUser(session.user.id);

  const country = request.nextUrl.searchParams.get("country");
  if (!country) {
    return Response.json({ error: "Parametro country obbligatorio" }, { status: 400 });
  }
  if (!COUNTRY_FORMAT.test(country)) {
    return Response.json({ error: "Formato country non valido" }, { status: 400 });
  }

  const provider = providerForNewConnections();
  try {
    const institutions = await getBankProvider(provider).listInstitutions(country);
    return Response.json(institutions);
  } catch (error) {
    if (error instanceof BankProviderError) {
      requestLogger().warn("bank.institutions.failed", { provider, status: error.status, error });
      return Response.json({ error: "Impossibile recuperare gli istituti bancari" }, { status: 502 });
    }
    throw error;
  }
}

export const GET = withRoute("bank.institutions.list", handleGet);
