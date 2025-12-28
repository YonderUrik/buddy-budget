"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { motion } from "framer-motion";
import { Button } from "@heroui/button";

import { title } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";

export default function WelcomePage() {
  const { update } = useSession();
  const router = useRouter();

  const handleGetStarted = async () => {
    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onboardingStep: OnboardingStep.USER_PROFILE,
        }),
      });

      if (!response.ok) throw new Error("Failed to update step");

      await update({
        onboardingStep: OnboardingStep.USER_PROFILE,
      });

      router.push("/onboarding/user-profile");
    } catch (error) {
      console.error("Error starting onboarding:", error);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-12 px-4">
      {/* Hero Section */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={title({ size: "lg" })}>
          Welcome to
          <br />
          <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
            Buddy Budget
          </span>
        </h1>
      </motion.div>

      {/* What is Onboarding Section */}
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-default-50/10 dark:bg-default-50/10 backdrop-blur-md border border-brand-blue-500/20 shadow-xl">
          <CardBody className="p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-3">Your Money, Your Way</h2>
              <p className="text-default-600 max-w-2xl mx-auto">
                Everyone&apos;s financial journey is unique. In just a few
                minutes, we&apos;ll customize Buddy Budget to match your goals,
                experience level, and preferences - so you get insights that
                actually matter to you.
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* CTA Button */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5, delay: 0.9 }}
      >
        <Button
          className="text-lg px-12 py-6 h-auto"
          color="primary"
          size="md"
          onPress={handleGetStarted}
        >
          Get Started
        </Button>
        <p className="text-xs text-default-500 mt-4">
          You can always update your information later
        </p>
      </motion.div>
    </div>
  );
}
