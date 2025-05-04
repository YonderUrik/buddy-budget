import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";

export async function DELETE(req) {
   try {
      const session = await getServerSession(authOptions);
      if (!session) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userId = session.user.id;

      const result = await prisma.$transaction(async (tx) => {
         await tx.user.delete({
            where: { id: userId },
         });
         return { success: true, message: "User deleted successfully" };
      });

      if (result.success) {
         return NextResponse.json({ message: "User deleted successfully" }, { status: 200 });
      } else {
         return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
      }

   } catch (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
}