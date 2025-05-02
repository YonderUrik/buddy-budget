import { NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { SupportTicketEmail } from "@/emails/SupportTicketEmail";
import { prisma } from "@/lib/prisma";
import { config } from "@/lib/config";
import fs from 'fs';
import path from 'path';

const resend = new Resend(process.env.RESEND_API_KEY);

// Load translations from i18n directory for server-side use
const loadTranslations = (locale) => {
  try {
    const filePath = path.resolve(process.cwd(), `src/i18n/locales/${locale}.json`);
    if (fs.existsSync(filePath)) {
      const fileContent = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(fileContent);
    }
    // Fallback to English if locale not found
    const enFilePath = path.resolve(process.cwd(), 'src/i18n/locales/en.json');
    const fileContent = fs.readFileSync(enFilePath, 'utf8');
    return JSON.parse(fileContent);
  } catch (error) {
    return null;
  }
};

const createContactFormSchema = (translations = {}) => z.object({
  email: z.string().email({ 
    message: translations?.validation?.invalidEmail || "Please enter a valid email address" 
  }),
  subject: z.string().min(3, { 
    message: translations?.validation?.subjectTooShort || "Subject must be at least 3 characters" 
  }),
  category: z.string().min(1, { 
    message: translations?.validation?.categoryRequired || "Please select a category" 
  }),
  message: z.string().min(10, { 
    message: translations?.validation?.messageTooShort || "Message must be at least 10 characters"
  }),
  name: z.string().optional(),
});

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
    
    // Load translations for the requested language
    const translations = loadTranslations(lang);
    
    // Validate the request data using translations
    const contactFormSchema = createContactFormSchema(translations);
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
        // TODO : Add multi-language on email
        from: `"${config.appName}" <${config.supportEmail}>`,
        to: ['roccafortedaniele28@gmail.com'],
        subject: `New Support Request: ${validatedData.subject}`,
        react: SupportTicketEmail({
          ...emailData,
          ticketId: displayTicketId
        }),
      });

    } catch (emailError) {
      console.error("Failed to send email:", emailError);
      // We'll still save the ticket but notify about email failure
    }
    
    // Return success response with translated message and ticket ID
    return NextResponse.json({ 
      success: true, 
      message: translations?.support?.messageSent || "Your message has been received. We'll get back to you soon.",
      ticketId: displayTicketId,
      supportTicketId: supportTicket.id
    });
    
  } catch (error) {
    
    // Get language from Accept-Language header, defaulting to English
    const acceptLanguage = request.headers.get("Accept-Language") || "en";
    const lang = acceptLanguage.split(",")[0].split("-")[0];
    const translations = loadTranslations(lang);
    
    // Handle validation errors
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: translations?.errors?.failedSubmission || "Invalid form data", errors: error.errors },
        { status: 400 }
      );
    }
    
    // Handle database errors separately
    if (error.code === 'P2002' || error.name === 'PrismaClientKnownRequestError') {
      return NextResponse.json(
        { success: false, message: translations?.errors?.unexpectedError || "Failed to save your request. Please try again later." },
        { status: 500 }
      );
    }
    
    // Handle other errors
    return NextResponse.json(
      { success: false, message: translations?.errors?.unexpectedError || "Failed to process your request. Please try again later." },
      { status: 500 }
    );
  }
} 