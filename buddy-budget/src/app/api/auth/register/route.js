import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hash } from "bcrypt";
import { z } from "zod";

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
    
    // Create the user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
      }
    });
    
    // Return success without sensitive data
    return NextResponse.json({
      success: true,
      message: "User registered successfully",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        hasCompletedOnboarding: user.hasCompletedOnboarding,
        image: user.image,
        primaryCurrency: user.primaryCurrency,
        dateFormat: user.dateFormat
      }
    });
    
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json({
      success: false,
      message: "errors.registrationFailed"
    }, { status: 500 });
  }
} 