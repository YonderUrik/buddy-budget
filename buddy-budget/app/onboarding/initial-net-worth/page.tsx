"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { motion } from "framer-motion";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";

export default function InitialNetWorthPage() {
  const { update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    initialNetWorth: "",
    targetNetWorth: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          initialNetWorth: parseFloat(formData.initialNetWorth) || 0,
          initialNetWorthDate: new Date(),
          targetNetWorth: parseFloat(formData.targetNetWorth) || 0,
          onboardingStep: OnboardingStep.PREFERENCES,
        }),
      });

      if (!response.ok) throw new Error("Failed to update net worth");

      await update({
        onboardingStep: OnboardingStep.PREFERENCES,
      });

      router.push("/onboarding/preferences");
    } catch (error) {
      console.error("Error updating net worth:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={title({ size: "md" })}>Your Net Worth</h1>
        <p className={subtitle({ class: "mt-2" })}>
          Help us understand your starting point
        </p>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-default-50/10 dark:bg-default-50/10 backdrop-blur-md border border-brand-blue-500/20 shadow-xl">
          <CardBody className="p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div>
                <Input
                  required
                  description="Total assets minus total liabilities"
                  label="Current Net Worth"
                  placeholder="0"
                  startContent={<span className="text-default-400">$</span>}
                  type="number"
                  value={formData.initialNetWorth}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initialNetWorth: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Input
                  required
                  description="What's your long-term net worth goal?"
                  label="Target Net Worth"
                  placeholder="0"
                  startContent={<span className="text-default-400">$</span>}
                  type="number"
                  value={formData.targetNetWorth}
                  onChange={(e) =>
                    setFormData({ ...formData, targetNetWorth: e.target.value })
                  }
                />
              </div>

              <div className="flex gap-4">
                <Button
                  className="flex-1"
                  type="button"
                  variant="flat"
                  onPress={() => router.push("/onboarding/user-profile")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  color="primary"
                  isLoading={loading}
                  type="submit"
                >
                  Continue
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
