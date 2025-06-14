import { NextResponse } from "next/server"
import nodemailer from "nodemailer"
import { auth } from "@/lib/auth"
import { APP_NAME, LEGAL_CONTACT_EMAIL } from "@/lib/config"

export async function POST(request) {
  try {
    const { name, email, subject, message, category } = await request.json()

    // Validation
    if (!name || !email || !subject || !message) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 }
      )
    }

    if (message.length < 10) {
      return NextResponse.json(
        { error: "Message must be at least 10 characters long" },
        { status: 400 }
      )
    }

    // Get user session if available
    const session = await auth()
    const userId = session?.user?.id || "Anonymous"

    // Create email transporter
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_SERVER_USER,
        pass: process.env.EMAIL_SERVER_PASSWORD,
      },
    })

    // Send email to support team
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: process.env.EMAIL_FROM,
      subject: `[${APP_NAME} Support] ${category ? `[${category}] ` : ""}${subject}`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333; border-bottom: 2px solid #007cba; padding-bottom: 10px;">New Support Request</h2>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Contact Information</h3>
            <p style="margin: 5px 0;"><strong>Name:</strong> ${name}</p>
            <p style="margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 5px 0;"><strong>User ID:</strong> ${userId}</p>
            ${category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>` : ""}
          </div>

          <div style="background-color: #fff; padding: 15px; border: 1px solid #dee2e6; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Subject</h3>
            <p style="margin: 0; font-weight: 500;">${subject}</p>
          </div>

          <div style="background-color: #fff; padding: 15px; border: 1px solid #dee2e6; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #333;">Message</h3>
            <div style="white-space: pre-wrap; line-height: 1.5;">${message}</div>
          </div>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px;">
            <p>This message was sent from the ${APP_NAME} contact form.</p>
            <p>Timestamp: ${new Date().toISOString()}</p>
          </div>
        </div>
      `,
    })

    // Send confirmation email to user
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: `We received your message - ${APP_NAME} Support`,
      html: `
        <div style="max-width: 600px; margin: 0 auto; padding: 20px; font-family: Arial, sans-serif;">
          <h2 style="color: #333; text-align: center;">Thank You for Contacting Us</h2>
          
          <p>Hi ${name},</p>
          
          <p>We've received your support request and will get back to you as soon as possible. Here's a copy of what you sent:</p>
          
          <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Subject:</strong> ${subject}</p>
            ${category ? `<p style="margin: 5px 0;"><strong>Category:</strong> ${category}</p>` : ""}
            <p style="margin: 5px 0;"><strong>Message:</strong></p>
            <div style="white-space: pre-wrap; margin-top: 10px; padding: 10px; background-color: white; border-radius: 4px;">${message}</div>
          </div>

          <div style="background-color: #e7f3ff; padding: 15px; border-radius: 6px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #0066cc;">What happens next?</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Our support team will review your request</li>
              <li>We typically respond within 24-48 hours</li>
              <li>For urgent issues, we'll prioritize your request</li>
              <li>You'll receive updates at this email address</li>
            </ul>
          </div>

          <p>If you have any additional information or questions, feel free to reply to this email.</p>
          
          <p>Best regards,<br>The ${APP_NAME} Support Team</p>

          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 12px; text-align: center;">
            <p>This is an automated confirmation email from ${APP_NAME}.</p>
          </div>
        </div>
      `,
    })

    return NextResponse.json(
      { message: "Your message has been sent successfully. We'll get back to you soon!" },
      { status: 200 }
    )
  } catch (error) {
    console.error("Contact form error:", error)
    return NextResponse.json(
      { error: "Failed to send message. Please try again later." },
      { status: 500 }
    )
  }
} 