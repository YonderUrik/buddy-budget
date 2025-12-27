import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UpdateOnboardingInput } from "@/types/user";

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body: UpdateOnboardingInput = await request.json();

    // Prepare update data with proper type conversions
    const updateData: any = {
      ...body,
      updatedAt: new Date(),
    };

    // Convert financialGoals array to JSON if present
    if (body.financialGoals) {
      updateData.financialGoals = body.financialGoals as any;
    }

    // Update user in database using email as the identifier
    const updatedUser = await prisma.user.update({
      where: { email: session.user.email },
      data: updateData,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error("Error updating onboarding:", error);

    return NextResponse.json(
      { error: "Failed to update onboarding" },
      { status: 500 },
    );
  }
}
