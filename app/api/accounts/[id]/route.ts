import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

const allowedTypes = new Set(["CASH", "CHECKING", "SAVINGS", "CREDIT_CARD", "INVESTMENT"]);

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const userId = (session.user as any).id as string;
  const accountId = params.id;
  
  try {
    // First, check if account exists and belongs to user
    const existingAccount = await (prisma as any).financialAccount.findFirst({
      where: { 
        id: accountId, 
        userId,
        isArchived: false 
      }
    });

    if (!existingAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const { name, type, currency, balance, institutionName, icon, color } = body ?? {};

    // For linked accounts (provider !== 'manual'), only allow name changes
    const isLinkedAccount = existingAccount.provider !== 'manual';
    
    let updateData: any = {};

    if (name !== undefined) {
      updateData.name = name;
    }

    // Only allow other fields for manual accounts
    if (!isLinkedAccount) {
      if (type !== undefined) {
        if (!allowedTypes.has(type)) {
          return NextResponse.json({ error: "Invalid account type" }, { status: 400 });
        }
        updateData.type = type;
      }
      
      if (currency !== undefined) {
        updateData.currency = currency;
      }
      
      if (balance !== undefined && typeof balance === "number") {
        updateData.balance = balance;
      }
      
      if (institutionName !== undefined) {
        updateData.institutionName = institutionName || null;
      }
      
      if (icon !== undefined) {
        updateData.icon = icon || null;
      }
      
      if (color !== undefined) {
        updateData.color = color || null;
      }
    }

    // If no updates provided
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    updateData.updatedAt = new Date();

    const updated = await (prisma as any).financialAccount.update({
      where: { id: accountId },
      data: updateData
    });

    return NextResponse.json(updated);
  } catch (e: any) {
    console.error('Account update error:', e);
    return NextResponse.json({ error: "Failed to update account" }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  
  const userId = (session.user as any).id as string;
  const accountId = params.id;
  
  try {
    // Check if account exists and belongs to user
    const existingAccount = await (prisma as any).financialAccount.findFirst({
      where: { 
        id: accountId, 
        userId,
        isArchived: false 
      }
    });

    if (!existingAccount) {
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    }

    // For linked accounts, we should archive instead of delete to preserve transaction history
    const isLinkedAccount = existingAccount.provider !== 'manual';
    
    if (isLinkedAccount) {
      // Archive the account instead of deleting
      await (prisma as any).financialAccount.update({
        where: { id: accountId },
        data: { 
          isArchived: true,
          updatedAt: new Date()
        }
      });
    } else {
      // For manual accounts, we can safely delete (this will cascade delete transactions)
      await (prisma as any).financialAccount.delete({
        where: { id: accountId }
      });
    }

    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error('Account deletion error:', e);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}