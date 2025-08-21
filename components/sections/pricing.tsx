"use client";

import { useState } from "react";
import { Card, CardBody, user } from "@heroui/react";
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

        {/* Pricing Comparison Table */}
        <div className="max-w-7xl mx-auto">
          <Card className="overflow-hidden" isBlurred>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  {/* Header Row */}
                  <thead>
                    <tr className="border-b border-divider">
                      <th className="text-left p-6 w-1/4">
                        <div className="text-lg font-semibold text-foreground-600">Features</div>
                      </th>
                      
                      {showFreePlan && (
                        <th className="text-center p-6 w-1/4">
                          <div className="space-y-2">
                            <h3 className="text-xl font-bold">{dict.pricing.plans.free.name}</h3>
                            <div className="text-3xl font-bold text-primary">{dict.pricing.plans.free.title}</div>
                            <p className="text-sm text-foreground-600">{dict.pricing.plans.free.description}</p>
                            {showButtons && (
                              <Button className="w-full mt-4" variant="bordered" color="primary">
                                {dict.pricing.getStarted}
                              </Button>
                            )}
                          </div>
                        </th>
                      )}
                      
                      <th className={`text-center p-6 w-1/4 ${currentPlan === "PRO" ? "bg-success/10 relative" : "bg-primary/10 relative"}`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <h3 className="text-xl font-bold">{dict.pricing.plans.pro.name}</h3>
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
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-bold text-primary">
                              €{isYearly ? plans.find(p => p.id === "growth")?.yearlyPrice : plans.find(p => p.id === "growth")?.monthlyPrice}
                            </span>
                            <span className="text-sm text-foreground-600">
                              /{isYearly ? 'year' : 'month'}
                            </span>
                          </div>
                          <p className="text-sm text-foreground-600">{dict.pricing.plans.pro.description}</p>
                          {showButtons && (
                            <Button
                              onPress={() => {
                                if (currentPlan === "PRO") return;
                                if (currentPlan === "FREE") {
                                  handleCheckout("growth");
                                } else {
                                  handleUpgrade("growth");
                                }
                              }}
                              className="w-full mt-4"
                              color={currentPlan === "PRO" ? "success" : "primary"}
                              isDisabled={currentPlan === "PRO"}
                              isLoading={loading === "growth"}
                            >
                              {currentPlan === "PRO" ? dict.pricing.currentPlan : dict.pricing.choosePlan}
                            </Button>
                          )}
                        </div>
                      </th>
                      
                      <th className={`text-center p-6 w-1/4 ${currentPlan === "LEGACY" ? "bg-success/10" : ""}`}>
                        <div className="space-y-2">
                          <div className="flex items-center justify-center gap-2">
                            <h3 className="text-xl font-bold">{dict.pricing.plans.premium.name}</h3>
                            {currentPlan === "LEGACY" && (
                              <Chip color="success" size="sm">
                                {dict.pricing.currentPlan}
                              </Chip>
                            )}
                          </div>
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-3xl font-bold text-primary">
                              €{isYearly ? plans.find(p => p.id === "legacy")?.yearlyPrice : plans.find(p => p.id === "legacy")?.monthlyPrice}
                            </span>
                            <span className="text-sm text-foreground-600">
                              /{isYearly ? 'year' : 'month'}
                            </span>
                          </div>
                          <p className="text-sm text-foreground-600">{dict.pricing.plans.premium.description}</p>
                          {showButtons && (
                            <Button
                              className="w-full mt-4"
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
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  
                  <tbody>
                    {/* Feature Rows */}
                    {dict.pricing.comparison.features.map((feature, index) => {
                      const renderValue = (value: string | boolean) => {
                        if (typeof value === 'boolean') {
                          return value ? (
                            <IconCheck className="w-5 h-5 text-success mx-auto" />
                          ) : (
                            <span className="text-foreground-400">—</span>
                          );
                        }
                        return <span className="text-sm font-medium">{value}</span>;
                      };

                      return (
                        <tr key={index} className={`border-b border-divider ${index % 2 === 0 ? 'bg-default-50/50' : ''}`}>
                          <td className="p-4 text-sm font-medium">{feature.name}</td>
                          
                          {showFreePlan && (
                            <td className="p-4 text-center">
                              <div className="flex justify-center">
                                {renderValue(feature.free)}
                              </div>
                            </td>
                          )}
                          
                          <td className={`p-4 text-center ${currentPlan === "PRO" ? "bg-success/5" : "bg-primary/5"}`}>
                            <div className="flex justify-center">
                              {renderValue(feature.pro)}
                            </div>
                          </td>
                          
                          <td className={`p-4 text-center ${currentPlan === "LEGACY" ? "bg-success/5" : ""}`}>
                            <div className="flex justify-center">
                              {renderValue(feature.premium)}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>

      </div>
    </section>
  );
}