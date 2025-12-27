"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Card, CardBody } from "@heroui/card";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";

export default function ProfileSetupPage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    firstName: session?.user?.name?.split(" ")[0] || "",
    lastName: session?.user?.name?.split(" ").slice(1).join(" ") || "",
    displayName: session?.user?.name || "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          onboardingStep: OnboardingStep.FINANCIAL_GOALS,
          onboardingStartedAt: new Date(),
        }),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      // Update session
      await update({
        onboardingStep: OnboardingStep.FINANCIAL_GOALS,
      });

      router.push("/onboarding/financial-goals");
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className={title({ size: "md" })}>Welcome! Let's get started</h1>
        <p className={subtitle({ class: "mt-2" })}>
          Tell us a bit about yourself
        </p>
      </div>

      <Card>
        <CardBody className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Input
              required
              label="First Name"
              placeholder="Enter your first name"
              value={formData.firstName}
              onChange={(e) =>
                setFormData({ ...formData, firstName: e.target.value })
              }
            />

            <Input
              required
              label="Last Name"
              placeholder="Enter your last name"
              value={formData.lastName}
              onChange={(e) =>
                setFormData({ ...formData, lastName: e.target.value })
              }
            />

            <Input
              required
              label="Display Name"
              placeholder="How should we call you?"
              value={formData.displayName}
              onChange={(e) =>
                setFormData({ ...formData, displayName: e.target.value })
              }
            />

            <Button
              className="w-full"
              color="primary"
              isLoading={loading}
              size="lg"
              type="submit"
            >
              Continue
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
