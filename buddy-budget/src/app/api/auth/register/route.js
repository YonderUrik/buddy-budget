import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcrypt";
import { z } from "zod";
import { Resend } from "resend";
import { config } from "@/lib/config";
import VerificationEmail from "@/emails/RegistrationVerifyEmail";

// Registration data validation schema
const registerSchema = z.object({
  name: z.string().min(1, { message: "Name is required" }),
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z
    .string()
    .min(8, { message: "Password must be at least 8 characters" })
    .regex(/[a-z]/, { message: "Password must contain at least one lowercase letter" })
    .regex(/[A-Z]/, { message: "Password must contain at least one uppercase letter" })
    .regex(/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, {
      message: "Password must contain at least one number or special character"
    }),
});

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request) {
  try {
    // Parse request body
    const body = await request.json();

    // Validate input data
    const result = registerSchema.safeParse(body);
    if (!result.success) {
      const errors = result.error.flatten();
      return NextResponse.json({
        success: false,
        message: errors.formErrors[0] || Object.values(errors.fieldErrors)[0][0] || "Validation failed"
      }, { status: 400 });
    }

    const { name, email, password } = result.data;

    // Check if user with this email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json({
        success: false,
        message: "errors.emailAlreadyInUse"
      }, { status: 409 });
    }

    // Hash the password
    const hashedPassword = await hash(password, 12);

    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const codeExpiryTime = new Date();
    codeExpiryTime.setHours(codeExpiryTime.getHours() + 1); // Code expires in 1 hour

    // Use transaction to create user and verification code
    const resultTransaction = await prisma.$transaction(async (tx) => {
      // Create the user
      const user = await tx.user.create({
        data: {
          name,
          email,
          password: hashedPassword,
          isActive: false
        }
      });

      // Create verification code
      const authCode = await tx.userAuthenticationCodes.create({
        data: {
          userId: user.id,
          code: verificationCode,
          type: "registration",
          expiresAt: codeExpiryTime
        }
      });

      const emailResult = await resend.emails.send({
        // TODO : Insert a correct name for the sender
        // TODO : Add multi-language on email
        from: config.authenticationEmail,
        to: [email],
        subject: `Your verification code is: ${verificationCode}`,
        react: VerificationEmail({
          verificationCode
        })
      })

      if (!emailResult || emailResult.error) {
        throw new Error("Failed to send verification email");
      }

      return authCode;
    });

    // Return success without sensitive data
    return NextResponse.json({
      success: true,
      message: "User registered successfully",
      type: resultTransaction?.type,
      userId: resultTransaction?.userId

    });

  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({
      success: false,
      message: "errors.registrationFailed"
    }, { status: 500 });
  }
} 