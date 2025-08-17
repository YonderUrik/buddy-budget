import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { gcGetAccountDetails, gcGetRequisition } from "@/lib/gocardless";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  const { requisitionId } = body ?? {};
  
  if (!requisitionId) {
    return NextResponse.json({ error: "Missing requisitionId" }, { status: 400 });
  }

  try {
    const requisition = await gcGetRequisition(requisitionId);
    const accountIds: string[] = requisition.accounts ?? [];

    // Try get the institution name from our saved connection to propagate to accounts
    const connection = await (prisma as any).bankConnection.findFirst({ where: { userId, requisitionId } });
    const institutionName: string | undefined = connection?.institutionName ?? undefined;

    await (prisma as any).bankConnection.updateMany({
      where: { userId, requisitionId },
      data: { status: requisition.status ?? "LINKED" },
    });

    const createdIds: string[] = [];
    for (const externalAccountId of accountIds) {
      try {
        const { details, balances } = await gcGetAccountDetails(externalAccountId);
        const name = details?.account?.name || details?.account?.display_name || "Bank account";
        const currency = balances?.balances?.[0]?.balanceAmount?.currency || "EUR";
        const amountRaw = balances?.balances?.[0]?.balanceAmount?.amount;
        const balance = typeof amountRaw === "string" ? parseFloat(amountRaw) : (typeof amountRaw === "number" ? amountRaw : 0);

        const existing = await (prisma as any).financialAccount.findFirst({ where: { userId, externalAccountId } });
        const record = existing
          ? await (prisma as any).financialAccount.update({
              where: { id: existing.id },
              data: { name, currency, balance, provider: "gocardless", connectionId: requisitionId, institutionName },
            })
          : await (prisma as any).financialAccount.create({
              data: {
                userId,
                name,
                type: "CHECKING" as any,
                currency,
                balance,
                provider: "gocardless",
                externalAccountId,
                connectionId: requisitionId,
                institutionName,
              },
            });
        createdIds.push(record.id);
      } catch (_inner) {
        // Skip any failed account and continue
      }
    }

    return NextResponse.json({ success: true, createdIds });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}


