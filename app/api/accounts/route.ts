import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const allowedTypes = new Set(["CASH", "CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT"]);

export async function GET() {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const accounts = await (prisma as any).financialAccount.findMany({
      where: { userId: (session.user as any).id, isArchived: false },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(accounts);
  } catch (_e) {
    return NextResponse.json({ error: "Failed to fetch accounts" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  const { name, type, currency, balance } = body ?? {};

  if (!name || !type || !currency) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
  }
  const initialBalance = typeof balance === "number" ? balance : 0;
  try {
    const created = await (prisma as any).financialAccount.create({
      data: {
        userId,
        name,
        type: type as any,
        currency,
        balance: initialBalance,
        provider: "manual",
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (_e) {
    return NextResponse.json({ error: "Failed to create account" }, { status: 500 });
  }
}


