import { NextRequest, NextResponse } from "next/server";
import Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { getPlanTierFromProductId, plans } from '@/config/plans';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '');
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY ?? '';

if (!webhookSecret) {
   throw new Error('STRIPE_WEBHOOK_SECRET_KEY is not set');
}

if (!stripe) {
   throw new Error('STRIPE_SECRET_KEY is not set');
}

export async function POST(request: NextRequest) {
   const body = await request.text();

   const signature = request.headers.get("stripe-signature") ?? '';

   let event: Stripe.Event;

   try {
      event = stripe.webhooks.constructEvent(body, signature ?? '', webhookSecret);
   } catch (err: any) {
      console.error('Error verifying webhook signature:', err);
      return NextResponse.json({ message: `Webhook Error: ${err.message}` }, { status: 400 });
   }

   switch (event.type) {

      case 'checkout.session.completed':
         const checkoutSession = event.data.object as Stripe.Checkout.Session;

         const session = await stripe.checkout.sessions.retrieve(
            event.data.object.id,
            {
               expand: ['line_items']
            }
         );

         const customerId = session?.customer;
         const customerEmail = session?.customer_details?.email;
         const lineItems = session?.line_items?.data;
         const subscriptionId = session?.subscription;

         if (customerEmail && lineItems && lineItems.length > 0) {
            try {

               let planTier: 'PRO' | 'LEGACY' = 'PRO';

               // First try to get plan tier from metadata (for new checkout sessions)
               if (session.metadata?.planId) {
                  const plan = plans.find(p => p.id === session.metadata.planId);
                  if (plan) {
                     planTier = plan.tier;
                  }
               } else {
                  // Fallback to product ID method (for old payment links)
                  const productId = lineItems[0].price?.product;
                  
                  if (typeof productId === 'string') {
                     const determinedTier = getPlanTierFromProductId(productId);
                     if (determinedTier) {
                        planTier = determinedTier;
                     }
                  }
               }

               let finalCustomerId = customerId;

               // Check if customer with this email already exists in Stripe
               const existingCustomers = await stripe.customers.list({
                  email: customerEmail,
                  limit: 1
               });

               // If there's already a customer with this email, use that customer ID
               if (existingCustomers.data.length > 0) {
                  finalCustomerId = existingCustomers.data[0].id;
               }

               // Cancel all OTHER active subscriptions for this customer
               // This handles both upgrades/downgrades and duplicate customer scenarios
               if (typeof finalCustomerId === 'string') {
                  const existingSubscriptions = await stripe.subscriptions.list({
                     customer: finalCustomerId,
                     status: 'active',
                  });

                  console.log(`Found ${existingSubscriptions.data.length} active subscriptions for customer ${finalCustomerId}`);

                  for (const subscription of existingSubscriptions.data) {
                     // Don't cancel the subscription that was just created
                     if (subscription.id !== subscriptionId) {
                        await stripe.subscriptions.cancel(subscription.id);
                        console.log(`Cancelled existing subscription ${subscription.id} for customer ${finalCustomerId}`); 
                     }
                  }
               }

               // Update user in database
               await prisma.user.update({
                  where: { email: customerEmail },
                  data: {
                     plan: planTier,
                     stripeCustomerId: typeof finalCustomerId === 'string' ? finalCustomerId : undefined
                  }
               });

               console.log(`Updated user ${customerEmail} to ${planTier} plan`);
            } catch (error) {
               console.error('Error updating user plan:', error);
            }
         }

         console.log('Checkout session completed:', checkoutSession.id);
         break;

      case 'customer.subscription.deleted':
         const subscription = event.data.object as Stripe.Subscription;
         const subscriptionCustomerId = subscription.customer;

         if (typeof subscriptionCustomerId === 'string') {
            try {
               // First check if customer has any other active subscriptions
               const activeSubscriptions = await stripe.subscriptions.list({
                  customer: subscriptionCustomerId,
                  status: 'active',
                  limit: 1
               });

               // Only reset to FREE if no other active subscriptions exist
               if (activeSubscriptions.data.length === 0) {
                  await prisma.user.updateMany({
                     where: {
                        stripeCustomerId: subscriptionCustomerId
                     },
                     data: {
                        plan: 'FREE'
                     }
                  });

                  console.log(`Reset user with customer ID ${subscriptionCustomerId} to FREE plan`);
               } else {
                  console.log(`Customer ${subscriptionCustomerId} still has active subscriptions, not resetting to FREE`);
               }
            } catch (error) {
               console.error('Error resetting user plan to FREE:', error);
            }
         }
         break;

      case 'customer.subscription.updated':
         const updatedSubscription = event.data.object as Stripe.Subscription;
         const updatedCustomerId = updatedSubscription.customer;

         if (typeof updatedCustomerId === 'string' && updatedSubscription.status === 'active') {
            try {
               // Get the product ID from the subscription items
               const subscriptionItems = updatedSubscription.items.data;
               
               if (subscriptionItems.length > 0) {
                  const productId = subscriptionItems[0].price?.product;
                  
                  let planTier: 'PRO' | 'LEGACY' = 'PRO';
                  
                  if (typeof productId === 'string') {
                     const determinedTier = getPlanTierFromProductId(productId);
                     if (determinedTier) {
                        planTier = determinedTier;
                     }
                  }

                  // Update user plan in database
                  await prisma.user.updateMany({
                     where: {
                        stripeCustomerId: updatedCustomerId
                     },
                     data: {
                        plan: planTier
                     }
                  });

                  console.log(`Updated user with customer ID ${updatedCustomerId} to ${planTier} plan`);
               }
            } catch (error) {
               console.error('Error updating user plan from subscription update:', error);
            }
         }
         break;

      default:
         console.log(`Unhandled event type ${event.type}`);
   }

   return NextResponse.json({ message: "Webhook received" });
}