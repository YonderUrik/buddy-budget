'use client';

import { Dictionary } from "@/types/dictionary";
import { PricingSection } from "./sections/pricing";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { IconSettings, IconCreditCard, IconSparkles, IconShield, IconBolt, IconRocket } from "@tabler/icons-react";

export default function Upgrade({ dict, user }: { dict: Dictionary; user: any }) {
   const { plan } = user;
   const searchParams = useSearchParams();
   const [loading, setLoading] = useState(false);

   const handleManageSubscription = async () => {
      setLoading(true);
      try {
         const response = await fetch('/api/stripe/customer-portal', {
            method: 'POST',
            headers: {
               'Content-Type': 'application/json',
            },
         });

         const data = await response.json();

         if (!response.ok) {
            throw new Error(data.error || 'Failed to open customer portal');
         }

         if (data.url) {
            window.location.href = data.url;
         }
      } catch (error) {
         console.error('Error opening customer portal:', error);
         toast.error('Failed to open subscription management. Please try again.');
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      const success = searchParams.get('success');
      const canceled = searchParams.get('canceled');

      if (success === 'true') {
         toast.success('Subscription updated successfully!', {
            description: 'Your plan has been activated and you now have access to all features.'
         });
      } else if (canceled === 'true') {
         toast.error('Subscription canceled', {
            description: 'You can try again anytime or contact support if you need help.'
         });
      }
   }, [searchParams]);

   return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
         <div className="container mx-auto max-w-6xl px-4 py-8 space-y-8">
            {/* Hero Section */}
            <div className="text-center">
               <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full text-sm font-medium text-primary backdrop-blur-sm">
                  <IconSparkles className="w-4 h-4" />
                  <span>{dict.upgrade.badge}</span>
               </div>
               <div className="inline-flex ml-2 items-center gap-2 px-4 py-2 bg-success/10 border border-success/20 rounded-full text-sm font-medium text-success backdrop-blur-sm">
                  <IconShield className="w-4 h-4 text-success" />
                  <span>{dict.upgrade.security.badge}</span>
               </div>
            </div>

            {/* Current Plan Status - Enhanced */}
            {plan !== 'FREE' && (
               <Card className="group relative overflow-hidden border-0 bg-gradient-to-r from-primary/5 via-background to-secondary/5 backdrop-blur-xl">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <CardBody className="relative p-6">
                     <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                        <div className="flex items-center gap-4">
                           <div className="relative">
                              <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-75" />
                              <div className="relative bg-gradient-to-r from-primary to-secondary p-3 rounded-full">
                                 <IconBolt className="w-6 h-6 text-white" />
                              </div>
                           </div>
                           <div>
                              <Chip
                                 color="primary"
                                 size="lg"
                                 className="font-bold text-base"
                                 startContent={<IconShield className="w-4 h-4" />}
                              >
                                 {plan} Plan
                              </Chip>
                              <h3 className="font-bold text-xl sm:text-2xl mt-2">{dict.upgrade.currentSubscription.title}</h3>
                              <p className="text-foreground-600">
                                 {dict.upgrade.currentSubscription.description}
                              </p>
                           </div>
                        </div>

                        <div className="flex-1" />

                        <Button
                           color="primary"
                           size="md"
                           className="w-full sm:w-auto min-w-48 font-semibold bg-gradient-to-r from-primary to-primary hover:shadow-lg hover:shadow-primary/25 transition-all duration-300"
                           startContent={<IconSettings className="w-5 h-5" />}
                           onPress={handleManageSubscription}
                           isLoading={loading}
                        >
                           {dict.upgrade.currentSubscription.manageButton}
                        </Button>
                     </div>
                  </CardBody>
               </Card>
            )}

            {/* Pricing Section for Free Users */}
            {plan === 'FREE' && (
               <div className="">
                  <div className="text-center">
                     <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-primary bg-clip-text text-transparent">
                        {dict.upgrade.choosePlan.title}
                     </h2>
                     <p className="text-foreground-600 text-lg mt-4">
                        {dict.upgrade.choosePlan.description}
                     </p>
                  </div>
                  <PricingSection dict={dict} showButtons={true} showFreePlan={false} showHeader={false} currentPlan={plan} user={user} />
               </div>
            )}

            {/* Enhanced Help Section for Paid Users */}
            {plan !== 'FREE' && (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <Card className="group border-2 border-dashed border-primary/30 hover:border-primary/60 transition-all duration-300 hover:shadow-xl hover:shadow-primary/10">
                     <CardBody className="p-6 text-center">
                        <div className="relative">
                           <div className="absolute inset-0 bg-primary/20 rounded-full blur group-hover:bg-primary/30 transition-colors" />
                           <div className="relative bg-primary/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                              <IconCreditCard className="w-8 h-8 text-primary" />
                           </div>
                        </div>
                        <h3 className="font-bold text-lg mt-4">{dict.upgrade.helpCards.paymentMethods.title}</h3>
                        <p className="text-sm text-foreground-600 leading-relaxed mt-2">
                           {dict.upgrade.helpCards.paymentMethods.description}
                        </p>
                     </CardBody>
                  </Card>

                  <Card className="group border-2 border-dashed border-secondary/30 hover:border-secondary/60 transition-all duration-300 hover:shadow-xl hover:shadow-secondary/10">
                     <CardBody className="p-6 text-center">
                        <div className="relative">
                           <div className="absolute inset-0 bg-secondary/20 rounded-full blur group-hover:bg-secondary/30 transition-colors" />
                           <div className="relative bg-secondary/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center group-hover:bg-secondary/20 transition-colors">
                              <IconSettings className="w-8 h-8 text-secondary" />
                           </div>
                        </div>
                        <h3 className="font-bold text-lg mt-4">{dict.upgrade.helpCards.subscriptionSettings.title}</h3>
                        <p className="text-sm text-foreground-600 leading-relaxed mt-2">
                           {dict.upgrade.helpCards.subscriptionSettings.description}
                        </p>
                     </CardBody>
                  </Card>

                  <Card className="group border-2 border-dashed border-success/30 hover:border-success/60 transition-all duration-300 hover:shadow-xl hover:shadow-success/10 md:col-span-2 lg:col-span-1">
                     <CardBody className="p-6 text-center">
                        <div className="relative">
                           <div className="absolute inset-0 bg-success/20 rounded-full blur group-hover:bg-success/30 transition-colors" />
                           <div className="relative bg-success/10 p-4 rounded-full w-16 h-16 mx-auto flex items-center justify-center group-hover:bg-success/20 transition-colors">
                              <IconRocket className="w-8 h-8 text-success" />
                           </div>
                        </div>
                        <h3 className="font-bold text-lg mt-4">{dict.upgrade.helpCards.premiumFeatures.title}</h3>
                        <p className="text-sm text-foreground-600 leading-relaxed mt-2">
                           {dict.upgrade.helpCards.premiumFeatures.description}
                        </p>
                     </CardBody>
                  </Card>
               </div>
            )}

         </div>
      </div>
   );
}