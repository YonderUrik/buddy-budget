import { NextRequest, NextResponse } from "next/server";
import Stripe from 'stripe';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { plans } from '@/config/plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { planId, isYearly } = body;

    if (!planId || typeof isYearly !== 'boolean') {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const plan = plans.find(p => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
    }

    // Get user to check current subscription
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    // Get the appropriate price ID
    const priceId = isYearly ? plan.yearlyProductId : plan.monthlyProductId;
    const amount = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

    // Check if user already has a subscription
    let mode: 'subscription' | 'payment' = 'subscription';
    let customer: string | undefined;

    if (user?.stripeCustomerId) {
      // Check for existing active subscriptions
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 1
      });

      if (subscriptions.data.length > 0) {
        // User has existing subscription - we'll handle this as upgrade/downgrade
        return NextResponse.json({ 
          error: 'User already has active subscription. Use update endpoint.' 
        }, { status: 400 });
      }
      
      customer = user.stripeCustomerId;
    }

    // Create checkout session for new subscription
    const checkoutSession = await stripe.checkout.sessions.create({
      mode,
      customer,
      customer_email: customer ? undefined : session.user.email,
      line_items: [
        {
          price_data: {
            currency: 'eur',
            product: priceId,
            recurring: {
              interval: isYearly ? 'year' : 'month',
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/dashboard/upgrade?canceled=true`,
      metadata: {
        userId: user?.id || session.user.email,
        planId,
        isYearly: isYearly.toString(),
      },
    });

    return NextResponse.json({ 
      sessionId: checkoutSession.id,
      url: checkoutSession.url 
    });

  } catch (error) {
    console.error('Error creating checkout session:', error);
    return NextResponse.json({ 
      error: 'Failed to create checkout session' 
    }, { status: 500 });
  }
}