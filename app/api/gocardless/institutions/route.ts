import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { GoCardlessError, listInstitutions } from "@/lib/gocardless/client";

const COUNTRY_FORMAT = /^[A-Z]{2}$/;

export async function GET(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) return new Response(null, { status: 401 });

  const country = request.nextUrl.searchParams.get("country");
  if (!country) {
    return Response.json({ error: "Parametro country obbligatorio" }, { status: 400 });
  }
  if (!COUNTRY_FORMAT.test(country)) {
    return Response.json({ error: "Formato country non valido" }, { status: 400 });
  }

  try {
    const institutions = await listInstitutions(country);
    return Response.json(institutions);
  } catch (error) {
    if (error instanceof GoCardlessError) {
      return Response.json({ error: "Impossibile recuperare gli istituti bancari" }, { status: 502 });
    }
    throw error;
  }
}
