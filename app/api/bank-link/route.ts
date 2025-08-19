import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gcCreateRequisition, gcGetRequisition, gcGetInstitution, gcListInstitutions } from "@/lib/gocardless";

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
  const { institutionId, redirectUrl, forceConnection } = body ?? {};

  if (!institutionId || !redirectUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  try {
    // Check for existing active connections with this institution
    // CR=Created, ID=Linked, LN=Linked, GA=Giving Access, SA=Selecting Accounts  
    const existingConnections = await prisma.bankConnection.findMany({
      where: {
        userId,
        institutionId,
        status: { in: ["CR", "ID", "LN", "GA", "SA"] } // Active statuses
      },
      select: {
        id: true,
        status: true,
        institutionName: true,
        createdAt: true
      }
    });

    // Check for existing linked accounts from this institution  
    const existingAccounts = await prisma.financialAccount.findMany({
      where: {
        userId,
        provider: "gocardless",
        linked: true,
        isArchived: false,
        // Check by institution name since connectionId might not match
        institutionName: { not: null }
      },
      select: {
        id: true,
        name: true,
        institutionName: true,
        connectionId: true
      }
    });

    // Filter accounts that are from the same institution
    const sameInstitutionAccounts = existingAccounts.filter(account => 
      existingConnections.some(conn => conn.institutionName === account.institutionName)
    );

    // If duplicates exist and user hasn't forced connection, return warning
    if ((existingConnections.length > 0 || sameInstitutionAccounts.length > 0) && !forceConnection) {
      return NextResponse.json({
        warning: "duplicate_institution",
        message: "You already have accounts connected from this institution",
        existingConnections: existingConnections,
        existingAccounts: sameInstitutionAccounts,
        requiresConfirmation: true
      }, { status: 409 });
    }

    // Clean up any failed/expired requisitions from this institution before creating new one
    // RJ=Rejected, ER=Error, SU=Suspended, EX=Expired, GC=Granting Consent, UA=Undergoing Authentication
    const staleConnections = await prisma.bankConnection.findMany({
      where: {
        userId,
        institutionId,
        status: { in: ["RJ", "ER", "SU", "EX"] }, // Failed/expired statuses
        createdAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Older than 1 day
      }
    });

    if (staleConnections.length > 0) {
      await prisma.bankConnection.deleteMany({
        where: {
          id: { in: staleConnections.map(c => c.id) }
        }
      });
      console.log(`Cleaned up ${staleConnections.length} stale connections for institution ${institutionId}`);
    }

    const uniqueReference = `${userId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const requisition = await gcCreateRequisition({
      redirect: redirectUrl,
      institutionId,
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
        status: requisition.status,
        institutionId,
        institutionName,
        reference: requisition.reference,
      },
    });

    return NextResponse.json({ 
      link: requisition.link, 
      requisitionId: requisition.id,
      institutionName 
    });
  } catch (e: any) {
    console.error("Bank connection error:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


