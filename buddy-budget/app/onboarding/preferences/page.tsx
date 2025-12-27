"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep, Currency, AppTheme } from "@/lib/auth";

export default function PreferencesPage() {
  const { update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    defaultCurrency: "USD",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    appTheme: "SYSTEM",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultCurrency: formData.defaultCurrency,
          timezone: formData.timezone,
          appTheme: formData.appTheme,
          onboardingStep: OnboardingStep.COMPLETED,
          onboardingCompleted: true,
          onboardingCompletedAt: new Date(),
        }),
      });

      if (!response.ok) throw new Error("Failed to update preferences");

      await update({
        onboardingStep: OnboardingStep.COMPLETED,
        onboardingCompleted: true,
      });

      router.push("/dashboard");
    } catch (error) {
      console.error("Error updating preferences:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className={title({ size: "md" })}>Final Touches</h1>
        <p className={subtitle({ class: "mt-2" })}>Customize your experience</p>
      </div>

      <Card>
        <CardBody className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            <Select
              label="Default Currency"
              selectedKeys={[formData.defaultCurrency]}
              onChange={(e) =>
                setFormData({ ...formData, defaultCurrency: e.target.value })
              }
            >
              {Object.values(Currency).map((currency) => (
                <SelectItem key={currency} value={currency}>
                  {currency}
                </SelectItem>
              ))}
            </Select>

            <Select
              label="App Theme"
              selectedKeys={[formData.appTheme]}
              onChange={(e) =>
                setFormData({ ...formData, appTheme: e.target.value })
              }
            >
              {Object.values(AppTheme).map((theme) => (
                <SelectItem key={theme} value={theme}>
                  {theme}
                </SelectItem>
              ))}
            </Select>

            <div className="flex gap-4">
              <Button
                className="flex-1"
                type="button"
                variant="flat"
                onClick={() => router.back()}
              >
                Back
              </Button>
              <Button
                className="flex-1"
                color="primary"
                isLoading={loading}
                type="submit"
              >
                Complete Setup
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
