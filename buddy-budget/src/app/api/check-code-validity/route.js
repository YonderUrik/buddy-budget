import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const userId = searchParams.get("id");

    // Validate required parameters
    if (!type || !userId) {
      return NextResponse.json({
        success: false,
        message: "errors.tokenFailed",
        isValid: false
      }, { status: 400 });
    }

    // Find first non-expired verification code
    const verificationCode = await prisma.userAuthenticationCodes.findFirst({
      where: {
        userId: userId,
        type: type,
      }
    });

    // If no code found
    if (!verificationCode) {
      return NextResponse.json({
        success: true,
        isValid: false,
        message: "errors.codeNotFound"
      });
    }

    // Code is valid
    return NextResponse.json({
      success: true,
      isValid: true,
    });

  } catch (error) {
    console.error("Verification check error:", error);
    return NextResponse.json({
      success: false,
      isValid: false,
      message: "Error checking verification code"
    }, { status: 500 });
  }
}
