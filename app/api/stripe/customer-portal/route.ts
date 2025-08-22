import { NextRequest, NextResponse } from "next/server";
import Stripe from 'stripe';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user with stripe customer ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ 
        error: 'No Stripe customer found' 
      }, { status: 400 });
    }

    // Create customer portal session
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade`,
    });

    return NextResponse.json({ 
      url: portalSession.url 
    });

  } catch (error) {
    console.error('Error creating customer portal session:', error);
    return NextResponse.json({ 
      error: 'Failed to create customer portal session' 
    }, { status: 500 });
  }
}