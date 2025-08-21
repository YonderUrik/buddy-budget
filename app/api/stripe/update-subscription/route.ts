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

    // Get user with stripe customer ID
    const user = await prisma.user.findUnique({
      where: { email: session.user.email }
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json({ 
        error: 'No Stripe customer found. Create new subscription instead.' 
      }, { status: 400 });
    }

    // Get current active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: user.stripeCustomerId,
      status: 'active',
      limit: 1
    });

    if (subscriptions.data.length === 0) {
      return NextResponse.json({ 
        error: 'No active subscription found. Create new subscription instead.' 
      }, { status: 400 });
    }

    const currentSubscription = subscriptions.data[0];
    
    // Get the appropriate price ID for the new plan
    const priceId = isYearly ? plan.yearlyProductId : plan.monthlyProductId;
    const amount = isYearly ? plan.yearlyPrice : plan.monthlyPrice;

    // Create new price if it doesn't exist
    let stripePrice;
    try {
      // Try to retrieve existing price
      const prices = await stripe.prices.list({
        product: priceId,
        active: true,
        limit: 1
      });
      
      if (prices.data.length > 0) {
        stripePrice = prices.data[0];
      } else {
        // Create new price
        stripePrice = await stripe.prices.create({
          currency: 'eur',
          product: priceId,
          recurring: {
            interval: isYearly ? 'year' : 'month',
          },
          unit_amount: Math.round(amount * 100), // Convert to cents
        });
      }
    } catch (error) {
      console.error('Error handling price:', error);
      return NextResponse.json({ 
        error: 'Failed to handle pricing' 
      }, { status: 500 });
    }

    // Update the subscription
    const updatedSubscription = await stripe.subscriptions.update(
      currentSubscription.id,
      {
        items: [{
          id: currentSubscription.items.data[0].id,
          price: stripePrice.id,
        }],
        proration_behavior: 'create_prorations',
        metadata: {
          userId: user.id,
          planId,
          isYearly: isYearly.toString(),
        },
      }
    );

    // Update user plan in database
    await prisma.user.update({
      where: { email: session.user.email },
      data: { plan: plan.tier }
    });

    return NextResponse.json({ 
      subscriptionId: updatedSubscription.id,
      success: true 
    });

  } catch (error) {
    console.error('Error updating subscription:', error);
    return NextResponse.json({ 
      error: 'Failed to update subscription' 
    }, { status: 500 });
  }
}