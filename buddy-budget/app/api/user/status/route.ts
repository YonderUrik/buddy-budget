import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";

/**
 * POST /api/user/status
 * Checks if a user exists and returns their onboarding status
 * Used by the JWT callback to populate token with correct onboarding state
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Check if user exists in database
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        onboardingCompleted: true,
        onboardingStep: true,
        provider: true,
      },
    });

    if (user) {
      return NextResponse.json({
        exists: true,
        onboardingCompleted: user.onboardingCompleted,
        onboardingStep: user.onboardingStep,
        provider: user.provider,
      });
    } else {
      return NextResponse.json({
        exists: false,
      });
    }
  } catch (error) {
    console.error("Error checking user status:", error);

    return NextResponse.json(
      { error: "Failed to check user status" },
      { status: 500 },
    );
  }
}
