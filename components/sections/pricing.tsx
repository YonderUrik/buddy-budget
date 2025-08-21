"use client";

import { useState } from "react";
import { Card, CardBody, CardFooter, CardHeader, user } from "@heroui/react";
import { Button } from "@heroui/react";
import { Switch } from "@heroui/react";
import { Chip } from "@heroui/react";
import { IconCheck } from "@tabler/icons-react";
import { Dictionary } from "@/types/dictionary";

interface PricingSectionProps {
  dict: Dictionary;
  showButtons?: boolean;
  showFreePlan?: boolean;
  showHeader?: boolean;
  currentPlan?: string;
  user?: any;
}

import { plans } from "@/config/plans";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function PricingSection({ dict, showButtons = false, showFreePlan = true, showHeader = true, currentPlan = "FREE", user }: PricingSectionProps) {
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  const handleCheckout = async (planId: string) => {
    setLoading(planId);
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          isYearly,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error('Error creating checkout:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleUpgrade = async (planId: string) => {
    setLoading(planId);
    try {
      const response = await fetch('/api/stripe/update-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          planId,
          isYearly,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update subscription');
      }

      router.refresh();
      toast.success('Subscription updated successfully!');
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast.error('Failed to update subscription. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <section className="relative py-20 overflow-hidden">
      <div className="relative container mx-auto px-4">
        {showHeader && (
          <div className="text-center mb-12">
            <p className="text-primary text-sm font-medium mb-2">
              {dict.pricing.kicker}
            </p>
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              {dict.pricing.heading}
            </h2>
            <p className="text-lg text-foreground-600 max-w-2xl mx-auto">
              {dict.pricing.description}
            </p>
          </div>
        )}

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={`text-sm ${!isYearly ? 'text-foreground' : 'text-foreground-400'}`}>
            {dict.pricing.monthlyToggle}
          </span>
          <Switch
            isSelected={isYearly}
            onValueChange={setIsYearly}
            color="primary"
          />
          <span className={`text-sm ${isYearly ? 'text-foreground' : 'text-foreground-400'}`}>
            {dict.pricing.yearlyToggle}
          </span>
          <Chip size="sm" color="success" variant="flat" className="ml-2">
            {dict.pricing.yearlyDiscount}
          </Chip>
        </div>

        {/* Pricing Cards */}
        <div className={`grid gap-6 max-w-5xl mx-auto ${showFreePlan ? 'md:grid-cols-3' : 'md:grid-cols-2 justify-items-center'}`}>

          {showFreePlan && (
            /* Free Plan */
            <Card className="relative" isBlurred>
              <CardHeader className="pb-2">
                <div className="w-full">
                  <h3 className="text-xl font-bold mb-1">
                    {dict.pricing.plans.free.name}
                  </h3>
                  <div className="flex items-baseline gap-1 mb-2">
                    <span className="text-4xl font-bold">{dict.pricing.plans.free.title}</span>
                  </div>
                  <p className="text-sm text-foreground-600">
                    {dict.pricing.plans.free.description}
                  </p>
                </div>
              </CardHeader>
              <CardBody className="pt-0">
                <ul className="space-y-3">
                  {dict.pricing.plans.free.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardBody>
              {showButtons && (
                <CardFooter>
                  <Button className="w-full" variant="bordered" color="primary">
                    {dict.pricing.getStarted}
                  </Button>
                </CardFooter>
              )}
            </Card>
          )}

          {/* Pro Plan */}
          <Card className={`relative w-full max-w-sm ${currentPlan === "PRO" ? "border-2 border-success/50 bg-success/5" : "border-2 border-primary/50"}`} isBlurred>
            <CardHeader className="pb-2">
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-bold">
                    {dict.pricing.plans.pro.name}
                  </h3>
                  {currentPlan === "PRO" ? (
                    <Chip color="success" size="sm">
                      {dict.pricing.currentPlan}
                    </Chip>
                  ) : (
                    <Chip color="primary" size="sm">
                      {dict.pricing.mostPopular}
                    </Chip>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">
                    €{isYearly ? plans.find(p => p.id === "growth")?.yearlyPrice : plans.find(p => p.id === "growth")?.monthlyPrice}
                  </span>
                  {isYearly && (
                    <span className="text-xs text-foreground-400 line-through ml-2">
                      €{((plans.find(p => p.id === "growth")?.yearlyPrice ?? 0) / 12).toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground-600">
                  {dict.pricing.plans.pro.description}
                </p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="space-y-3">
                {dict.pricing.plans.pro.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
            {showButtons && (
              <CardFooter>
                <Button
                  onPress={() => {
                    if (currentPlan === "PRO") return;
                    if (currentPlan === "FREE") {
                      handleCheckout("growth");
                    } else {
                      handleUpgrade("growth");
                    }
                  }}
                  className="w-full"
                  color={currentPlan === "PRO" ? "success" : "primary"}
                  isDisabled={currentPlan === "PRO"}
                  isLoading={loading === "growth"}
                >
                  {currentPlan === "PRO" ? dict.pricing.currentPlan : dict.pricing.choosePlan}
                </Button>
              </CardFooter>
            )}
          </Card>

          {/* Premium Plan */}
          <Card className="relative w-full max-w-sm" isBlurred>
            <CardHeader className="pb-2">
              <div className="w-full">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-xl font-bold">
                    {dict.pricing.plans.premium.name}
                  </h3>
                  {currentPlan === "LEGACY" && (
                    <Chip color="success" size="sm">
                      {dict.pricing.currentPlan}
                    </Chip>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-4xl font-bold">
                    €{isYearly ? plans.find(p => p.id === "legacy")?.yearlyPrice : plans.find(p => p.id === "legacy")?.monthlyPrice}
                  </span>
                  {isYearly && (
                    <span className="text-xs text-foreground-400 line-through ml-2">
                      €{((plans.find(p => p.id === "legacy")?.yearlyPrice ?? 0) / 12).toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground-600">
                  {dict.pricing.plans.premium.description}
                </p>
              </div>
            </CardHeader>
            <CardBody className="pt-0">
              <ul className="space-y-3">
                {dict.pricing.plans.premium.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <IconCheck className="w-4 h-4 text-success mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardBody>
            {showButtons && (
              <CardFooter>
                <Button
                  className="w-full"
                  color={currentPlan === "LEGACY" ? "success" : "primary"}
                  variant={currentPlan === "LEGACY" ? "solid" : "bordered"}
                  isDisabled={currentPlan === "LEGACY"}
                  isLoading={loading === "legacy"}
                  onPress={() => {
                    if (currentPlan === "LEGACY") return;
                    if (currentPlan === "FREE") {
                      handleCheckout("legacy");
                    } else {
                      handleUpgrade("legacy");
                    }
                  }}
                >
                  {currentPlan === "LEGACY" ? dict.pricing.currentPlan : dict.pricing.choosePlan}
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>

      </div>
    </section>
  );
}