"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { motion } from "framer-motion";
import {
  User,
  Target,
  DollarSign,
  Settings,
  CheckCircle2,
  Clock,
  TrendingUp,
} from "lucide-react";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";

const ONBOARDING_STEPS = [
  {
    icon: User,
    title: "Your Profile",
    description: "Tell us about your background and financial experience",
    color: "text-brand-blue-500",
  },
  {
    icon: Target,
    title: "Financial Goals",
    description: "Set clear targets for your financial journey",
    color: "text-brand-gold-500",
  },
  {
    icon: DollarSign,
    title: "Net Worth",
    description: "Understand your current financial position",
    color: "text-green-500",
  },
  {
    icon: Settings,
    title: "Preferences",
    description: "Customize your experience to fit your needs",
    color: "text-purple-500",
  },
];

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
    <div className="flex flex-col items-center justify-center min-h-screen gap-12 px-4 py-12">
      {/* Hero Section */}
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-3xl"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={title({ size: "lg" })}>
          Welcome to{" "}
          <span className="bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 bg-clip-text text-transparent">
            Buddy Budget
          </span>
        </h1>
        <p className={subtitle({ class: "mt-4 text-lg" })}>
          Let&apos;s set up your financial companion in just a few minutes
        </p>
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
              <h2 className="text-2xl font-bold mb-3">What is Onboarding?</h2>
              <p className="text-default-600 max-w-2xl mx-auto">
                Onboarding is a quick setup process that helps us understand
                your financial situation, goals, and preferences. This allows us
                to provide you with personalized insights, recommendations, and
                tracking tools tailored specifically to your needs.
              </p>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      {/* Steps Overview */}
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-4xl"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold mb-2">
            Your Journey in 4 Simple Steps
          </h2>
          <p className="text-default-600">
            It takes less than 5 minutes to complete
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {ONBOARDING_STEPS.map((step, index) => (
            <motion.div
              key={step.title}
              animate={{ opacity: 1, x: 0 }}
              initial={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
            >
              <Card className="bg-default-50/5 dark:bg-default-50/5 backdrop-blur-sm border border-default-200/20 hover:border-brand-blue-500/30 transition-all duration-300">
                <CardBody className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="p-3 rounded-full bg-default-100/50">
                        <step.icon className={`w-6 h-6 ${step.color}`} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-semibold text-default-500">
                          STEP {index + 1}
                        </span>
                      </div>
                      <h3 className="font-semibold text-lg mb-1">
                        {step.title}
                      </h3>
                      <p className="text-sm text-default-600">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </CardBody>
              </Card>
            </motion.div>
          ))}
        </div>

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
            size="lg"
            onPress={handleGetStarted}
          >
            Get Started
          </Button>
          <p className="text-xs text-default-500 mt-4">
            You can always update your information later
          </p>
        </motion.div>
      </motion.div>
    </div>
  );
}
