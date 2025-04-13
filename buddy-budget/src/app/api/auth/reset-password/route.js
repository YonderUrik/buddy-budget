import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcrypt";
import { z } from "zod";
import { config } from "@/lib/config";

const resetPasswordSchema = z.object({
   token: z.string().min(1, { message: "Token Required" }),
   password: z
      .string()
      .min(8, { message: "Password must be at least 8 characters" })
      .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
      .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
      .regex(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
         message: "Password must contain at least one number or special character"
      }),
})

export async function POST(request) {
   try {
      const body = await request.json()

      const result = resetPasswordSchema.safeParse(body)

      if (!result.success) {
         const errors = result.error.flatten();
         return NextResponse.json({
            success: false,
            message: errors.formErrors[0] || Object.values(errors.fieldErrors)[0][0] || "Validation failed"
         }, { status: 400 });
      }

      const { token, password } = result.data;

      const resultTransaction = await prisma.$transaction(async (tx) => {
         // Find the code and check it's not expired
         const userCode = await tx.userAuthenticationCodes.findFirst({
            where: {
               code: token,
               type: "password_reset",
               expiresAt: {
                  gt: new Date() // Check code hasn't expired
               }
            }
         });

         if (!userCode) {
            throw new Error("Invalid or expired reset code");
         }

         // Hash the new password
         const hashedPassword = await hash(password, 12);

         // Update the user's password
         const updatedUser = await tx.user.update({
            where: {
               id: userCode.userId
            },
            data: {
               password: hashedPassword
            }
         });

         // Delete all reset password codes for this user
         await tx.userAuthenticationCodes.deleteMany({
            where: {
               userId: userCode.userId,
               type: "password_reset"
            }
         });

         return { success: true };
      });

      return NextResponse.json({
         success: resultTransaction?.success
      })
   } catch (error) {
      console.error("Reset Password error:", error);
      return NextResponse.json({
         success: false,
         message: "errors.internalServerError"
      }, { status: 500 });
   }
}