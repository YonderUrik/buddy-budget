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

    // Get current user to merge settings
    const currentUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { settings: true },
    });

    // Prepare update data with proper type conversions
    const updateData: any = {
      ...body,
      updatedAt: new Date(),
    };

    // Convert financialGoals array to JSON if present
    if (body.financialGoals) {
      updateData.financialGoals = body.financialGoals as any;
    }

    // Merge settings instead of overwriting
    if (body.settings) {
      const existingSettings =
        typeof currentUser?.settings === "object" && currentUser?.settings
          ? currentUser.settings
          : {};

      updateData.settings = {
        ...existingSettings,
        ...body.settings,
      };
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
