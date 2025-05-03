import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function POST(req) {
   try {
      const session = await getServerSession(authOptions);
      if (!session) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userId = session.user.id;

      const result = await prisma.$transaction(async (tx) => {
         // Delete all accounts but keep categories
         await tx.account.deleteMany({
            where: { userId },
         });

         // Delete all wealth snapshots
         await tx.wealthSnapshot.deleteMany({
            where: { userId },
         });

         // Delete all user authentication codes
         await tx.userAuthenticationCodes.deleteMany({
            where: { userId },
         });

         await tx.category.deleteMany({
            where: { userId },
         });

         await tx.user.update({
            where: { id: userId },
            data: {
               hasCompletedOnboarding: false,
            },
         });

         return { success: true, message: "User data reset successfully" };
      });

      if (result.success) {
         return NextResponse.json({ message: "User data reset successfully" }, { status: 200 });
      } else {
         return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }

   } catch (error) {
      console.error("Error resetting user data:", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
} 