import { authOptions } from "@/lib/auth";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req) {
   try {
      const session = await getServerSession(authOptions);

      if (!session) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const { userId, dateFormat } = await req.json();
      await prisma.user.update({
         where: { id: userId },
         data: { dateFormat }
      });

      return NextResponse.json({ success: true, message: "Preferences updated successfully" }, { status: 200 });
   } catch (error) {
      console.error("Error updating preferences:", error);
      return NextResponse.json({ error: "Error updating preferences" }, { status: 500 });
   }
}
