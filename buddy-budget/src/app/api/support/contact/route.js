import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { SupportTicketEmail } from "@/emails/SupportTicketEmail";
import { prisma } from "@/lib/prisma";
import { ObjectId } from "bson";
import { config } from "@/lib/config";

// TODO : Cercare di utilizzare i18n per le traduzioni

const resend = new Resend(process.env.RESEND_API_KEY);


const createContactFormSchema = (messages = {}) => z.object({
  email: z.string().email({ 
    message: messages.invalidEmail || "Please enter a valid email address" 
  }),
  subject: z.string().min(3, { 
    message: messages.subjectTooShort || "Subject must be at least 3 characters" 
  }),
  category: z.string().min(1, { 
    message: messages.categoryRequired || "Please select a category" 
  }),
  message: z.string().min(10, { 
    message: messages.messageTooShort || "Message must be at least 10 characters"
  }),
  name: z.string().optional(),
});

// Default schema with English messages
const contactFormSchema = createContactFormSchema();

// For a complete implementation, we would load these from the server's i18n system
// This is a simplified example with hardcoded messages
const serverMessages = {
  en: {
    success: "Your message has been received. We'll get back to you soon.",
    invalidForm: "Invalid form data",
    processingError: "Failed to process your request. Please try again later.",
    emailError: "Failed to send email notification. Your request has been logged.",
    dbError: "Failed to save your request. Please try again later."
  }
  // Add other languages as needed
};

// Generate a unique ticket ID
const generateTicketId = () => {
  const date = new Date();
  const timestamp = date.getTime().toString().slice(-6);
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `TKT-${timestamp}-${random}`;
};

export async function POST(request) {
  try {
    // Parse the request body
    const body = await request.json();
    
    // Get language from Accept-Language header, defaulting to English
    const acceptLanguage = request.headers.get("Accept-Language") || "en";
    const lang = acceptLanguage.split(",")[0].split("-")[0];
    const messages = serverMessages[lang] || serverMessages.en;
    
    // Validate the request data
    const validatedData = contactFormSchema.parse(body);
    
    // Generate a ticket ID and format date
    const ticketId = generateTicketId();
    const dateReceived = new Date();
    const formattedDate = dateReceived.toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    // Prepare email data
    const emailData = {
      ...validatedData,
      ticketId,
      dateReceived: formattedDate,
      customerEmail: validatedData.email,
    };
    
    // Find user by email or use anonymous ID
    const user = await prisma.user.findUnique({
      where: { email: validatedData.email }
    });
    const customerId = user?.id || 'Anonymous';
    
    // Save the support ticket to the database
    const supportTicket = await prisma.supportTicket.create({
      data: {
        customerEmail: validatedData.email,
        customerId,
        subject: validatedData.subject,
        category: validatedData.category,
        message: validatedData.message,
        dateReceived,
        status: "Open"
      }
    });
    
    // Use the database-generated ID as part of the email if available
    const dbTicketId = supportTicket.id;
    const displayTicketId = ticketId + (dbTicketId ? `-${dbTicketId.substring(0, 6)}` : '');
    
    try {
      // Send email using Resend
      const emailResult = await resend.emails.send({
        from: config.supportEmail,
        to: ['roccafortedaniele28@gmail.com'],
        subject: `New Support Request: ${validatedData.subject}`,
        react: SupportTicketEmail({
          ...emailData,
          ticketId: displayTicketId
        }),
      });
      
      if (!emailResult || emailResult.error) {
        console.error("Email sending error:", emailResult?.error);
        // Continue processing even if email fails
      }

    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // We'll still save the ticket but notify about email failure
    }
    
    // Return success response with translated message and ticket ID
    return NextResponse.json({ 
      success: true, 
      message: messages.success,
      ticketId: displayTicketId,
      supportTicketId: supportTicket.id
    });
    
  } catch (error) {
    console.error("Support form error:", error);
    
    // Get language from Accept-Language header, defaulting to English
    const acceptLanguage = request.headers.get("Accept-Language") || "en";
    const lang = acceptLanguage.split(",")[0].split("-")[0];
    const messages = serverMessages[lang] || serverMessages.en;
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: messages.invalidForm, errors: error.errors },
        { status: 400 }
      );
    }
    
    // Handle database errors separately
    if (error.code === 'P2002' || error.name === 'PrismaClientKnownRequestError') {
      return NextResponse.json(
        { success: false, message: messages.dbError },
        { status: 500 }
      );
    }
    
    // Handle other errors
    return NextResponse.json(
      { success: false, message: messages.processingError },
      { status: 500 }
    );
  }
} 