import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

export async function POST(req) {
   try {
      const session = await getServerSession(authOptions);
      if (!session) {
         return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const userId = session.user.id;
      const { currentPassword, newPassword } = await req.json();

      // Validate request data
      if (!currentPassword || !newPassword) {
         return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }

      // Check password criteria
      const passwordRegex = {
         length: newPassword.length >= 8,
         lowercase: /[a-z]/.test(newPassword),
         uppercase: /[A-Z]/.test(newPassword),
         special: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword)
      };

      const isValidPassword = Object.values(passwordRegex).every(value => value === true);
      if (!isValidPassword) {
         return NextResponse.json({ error: "Password does not meet security requirements" }, { status: 400 });
      }

      // Get the user
      const user = await prisma.user.findUnique({
         where: { id: userId },
         select: { password: true }
      });

      if (!user) {
         return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Verify current password
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
         return NextResponse.json({ error: "Current password is incorrect" }, { status: 401 });
      }

      // Hash the new password
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // Update the password
      await prisma.user.update({
         where: { id: userId },
         data: { password: hashedPassword }
      });

      return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
   } catch (error) {
      console.error("Error changing password:", error);
      return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
   }
} 