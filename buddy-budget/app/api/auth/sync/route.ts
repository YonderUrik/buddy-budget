import { NextRequest, NextResponse } from "next/server";
import { AuthProvider as PrismaAuthProvider } from "@prisma/client";
import * as Sentry from "@sentry/nextjs";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

// Map our local AuthProvider enum to Prisma's AuthProvider enum
const providerMap: Record<string, PrismaAuthProvider> = {
  google: PrismaAuthProvider.GOOGLE,
  github: PrismaAuthProvider.GITHUB,
  apple: PrismaAuthProvider.APPLE,
};

/**
 * Helper function to extract first and last name from full name
 */
function extractNames(fullName: string | null | undefined): {
  firstName: string | null;
  lastName: string | null;
} {
  if (!fullName) {
    return { firstName: null, lastName: null };
  }

  const parts = fullName.trim().split(/\s+/);

  // istanbul ignore next - Defensive check: split() always returns at least one element
  if (parts.length === 0) {
    return { firstName: null, lastName: null };
  }

  const firstName = parts[0];
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return { firstName, lastName };
}

/**
 * POST /api/auth/sync
 * Syncs user data with the database after OAuth sign-in
 * This runs in Node.js runtime (not Edge) so Prisma works here
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { accountProvider, accountProviderId } = body;

    // Extract first and last name from the OAuth provider's name
    const { firstName, lastName } = extractNames(session.user.name);

    // Check if user exists in database
    const existingUser = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        onboardingCompleted: true,
        onboardingStep: true,
        email: true,
        name: true,
        image: true,
        provider: true,
        firstName: true,
        lastName: true,
      },
    });

    if (existingUser) {
      // Update existing user
      const updateData: any = {
        lastLoginAt: new Date(),
      };

      // Update name and image if changed from provider
      if (session.user.name && session.user.name !== existingUser.name) {
        updateData.name = session.user.name;
      }
      if (session.user.image && session.user.image !== existingUser.image) {
        updateData.image = session.user.image;
      }

      // Update firstName/lastName if not already set
      if (!existingUser.firstName && firstName) {
        updateData.firstName = firstName;
      }
      if (!existingUser.lastName && lastName) {
        updateData.lastName = lastName;
      }

      // Set provider if not already set
      if (!existingUser.provider && accountProvider) {
        const mappedProvider = providerMap[accountProvider];

        if (mappedProvider) {
          updateData.provider = mappedProvider;
          updateData.providerId = accountProviderId;
        }
      }

      const updatedUser = await prisma.user.update({
        where: { email: session.user.email },
        data: updateData,
        select: {
          id: true,
          email: true,
          onboardingCompleted: true,
          onboardingStep: true,
          provider: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: updatedUser,
      });
    } else {
      // Create new user
      const mappedProvider = accountProvider
        ? providerMap[accountProvider]
        : null;

      const newUser = await prisma.user.create({
        data: {
          email: session.user.email,
          name: session.user.name,
          firstName,
          lastName,
          displayName: firstName || session.user.name?.split(" ")[0] || null,
          image: session.user.image,
          provider: mappedProvider,
          providerId: accountProviderId,
          lastLoginAt: new Date(),
          onboardingCompleted: false,
          onboardingStep: "WELCOME", // Start with welcome screen
        },
        select: {
          id: true,
          email: true,
          onboardingCompleted: true,
          onboardingStep: true,
          provider: true,
        },
      });

      return NextResponse.json({
        success: true,
        user: newUser,
        isNew: true,
      });
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: {
        api_route: "/api/auth/sync",
        method: "POST",
      },
    });
    console.error("Error syncing user:", error);

    return NextResponse.json(
      { error: "Failed to sync user data" },
      { status: 500 },
    );
  }
}
