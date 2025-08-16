import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const categories = await prisma.category.findMany({
      where: { userId: (session.user as any).id, isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id as string;
  const body = await request.json().catch(() => ({}));
  const { name, icon, color, type, isActive } = body ?? {};

  if (!name || !type) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const allowedTypes = new Set(["income", "expense", "transfer"]);
  if (!allowedTypes.has(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  try {
    const created = await prisma.category.create({
      data: {
        userId,
        name,
        icon: icon ?? "mdi:tag",
        color: color ?? "#16a34a",
        type,
        isActive: typeof isActive === "boolean" ? isActive : true,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json({ error: "Category name already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: "Failed to create category" }, { status: 500 });
  }
}


