import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Resend } from "resend";
import VerificationEmail from "@/emails/RegistrationVerifyEmail";
import { config } from "@/lib/config";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    const { type, id } = await request.json();

    // Validate required parameters
    if (!type || !id) {
      return NextResponse.json({
        success: false,
        message: "Missing required parameters"
      }, { status: 400 });
    }

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find user
      const user = await tx.user.findUnique({
        where: { id },
        include: {
          authCodes: {
            where: { type }
          }
        }
      });

      if (!user) {
        throw new Error("User not found");
      }

      // Delete existing codes of this type
      if (user.authCodes.length > 0) {
        await tx.userAuthenticationCodes.deleteMany({
          where: {
            userId: id,
            type
          }
        });
      }

      // Generate new 6-digit code
      const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      
      // Create new verification code record
      const newCode = await tx.userAuthenticationCodes.create({
        data: {
          userId: id,
          code: verificationCode,
          type: type,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour expiry
        }
      });

      // Send email
      const emailResult = await resend.emails.send({
         // TODO : Add multi-language on email
        from: `"${config.appName}" <${config.authenticationEmail}>`,
        to: user.email,
        subject: `Your verification code is: ${verificationCode}`,
        react: VerificationEmail({ verificationCode })
      });

      if (!emailResult || emailResult.error) {
         throw new Error("Failed to send verification email");
      }

      return { success: true };
    });

    return NextResponse.json(result);

  } catch (error) {
    return NextResponse.json({
      success: false,
      message: error.message || "Error resending verification code"
    }, { status: 500 });
  }
}
