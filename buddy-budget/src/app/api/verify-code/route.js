import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request) {
   try {
      const { type, id, code } = await request.json();

      if (!type || !id || !code) {
         return NextResponse.json({
            success: false,
            message: "errors.tokenFailed"
         }, { status: 400 });
      }

      // Find the code and check if it's valid
      const authCode = await prisma.userAuthenticationCodes.findFirst({
         where: {
            userId: id,
            type: type,
            code: code,
            expiresAt: {
               gt: new Date() // Check if not expired
            }
         }
      });

      if (!authCode) {
         return NextResponse.json({
            success: false,
            message: "errors.invalidCode"
         }, { status: 400 });
      }

      // Use transaction to ensure both operations complete or neither does
      await prisma.$transaction([
         prisma.userAuthenticationCodes.deleteMany({
            where: {
               userId: id,
               type: type
            }
         }),
         prisma.user.update({
            where: {
               id: id
            },
            data: {
               isActive: true
            }
         })
      ]);

      return NextResponse.json({
         success: true,
         message: "verification_code.success"
      });

   } catch (error) {
      return NextResponse.json({
         success: false,
         message: "Error verifying code"
      }, { status: 500 });
   }
}