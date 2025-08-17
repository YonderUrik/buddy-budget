import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gcCreateAgreement, gcCreateRequisition, gcGetRequisition, gcGetInstitution, gcListInstitutions } from "@/lib/gocardless";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action");

  if (action === "institutions") {
    const country = searchParams.get("country") || "IT";
    try {
      const data = await gcListInstitutions(country);
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  if (action === "status") {
    const requisitionId = searchParams.get("requisitionId");
    if (!requisitionId) return NextResponse.json({ error: "Missing requisitionId" }, { status: 400 });
    try {
      const data = await gcGetRequisition(requisitionId);
      return NextResponse.json(data);
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  const { institutionId, redirectUrl } = body ?? {};

  if (!institutionId || !redirectUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    const agreement = await gcCreateAgreement(institutionId);
    const uniqueReference = `${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const requisition = await gcCreateRequisition({
      redirect: redirectUrl,
      institutionId,
      agreement: agreement.id,
      reference: uniqueReference,
    });

    let institutionName: string | undefined = undefined;
    try {
      const institution = await gcGetInstitution(institutionId);
      institutionName = institution?.name ?? undefined;
    } catch {}

    await prisma.bankConnection.create({
      data: {
        userId,
        provider: "gocardless",
        requisitionId: requisition.id,
        status: requisition.status ?? "PENDING",
        institutionId,
        institutionName,
      },
    });

    return NextResponse.json({ link: requisition.link, requisitionId: requisition.id });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


