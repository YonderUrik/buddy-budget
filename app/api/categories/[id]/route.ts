import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const { name, icon, color, type, isActive } = body ?? {};

  const data: any = {};
  if (name !== undefined) data.name = name;
  if (icon !== undefined) data.icon = icon;
  if (color !== undefined) data.color = color;
  if (type !== undefined) data.type = type;
  if (isActive !== undefined) data.isActive = isActive;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  if (data.type) {
    const allowedTypes = new Set(["income", "expense", "transfer"]);
    if (!allowedTypes.has(data.type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
  }

  try {
    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updated = await prisma.category.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to update category" }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = (session.user as any).id as string;
  const { id } = await params;

  try {
    const existing = await prisma.category.findFirst({ where: { id, userId } });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.category.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to disable category" }, { status: 500 });
  }
}


