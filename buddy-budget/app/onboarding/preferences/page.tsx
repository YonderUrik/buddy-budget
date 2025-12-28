"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Select, SelectItem } from "@heroui/select";
import { motion } from "framer-motion";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep, Currency } from "@/lib/auth";
import { DATE_FORMATS, NUMBER_FORMATS, LOCALES } from "@/lib/constants";
import {
  formatCurrencyWithLocale,
  formatChangeWithLocale,
  formatPercentWithLocale,
  formatDateByPattern,
} from "@/lib/format";

export default function PreferencesPage() {
  const { update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    defaultCurrency: "USD",
    dateFormat: "MM/DD/YYYY",
    numberFormat: "",
    timezone: "",
    locale: "",
  });

  // Set browser defaults on mount
  useEffect(() => {
    const browserLocale = navigator.language || "en-US";
    const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    setFormData((prev) => ({
      ...prev,
      numberFormat: browserLocale,
      timezone: browserTimezone,
      locale: browserLocale,
    }));
  }, []);

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
          locale: formData.locale,
          settings: {
            dateFormat: formData.dateFormat,
            numberFormat: formData.numberFormat,
          },
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
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={title({ size: "md" })}>Final Touches</h1>
        <p className={subtitle({ class: "mt-2" })}>Customize your experience</p>
      </motion.div>

      {/* Preview Card */}
      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.15 }}
      >
        <Card className="bg-default-50/10 dark:bg-default-50/10 backdrop-blur-md border border-brand-blue-500/20 shadow-xl">
          <CardBody className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm text-default-500 mb-2">
                  Example account
                </p>
                <h2 className="text-4xl font-bold mb-2">
                  {formatCurrencyWithLocale(
                    2325.25,
                    formData.defaultCurrency,
                    formData.numberFormat || "en-US"
                  )}
                </h2>
                <p className="text-sm text-success">
                  {formatChangeWithLocale(
                    78.9,
                    formData.defaultCurrency,
                    formData.numberFormat || "en-US"
                  )}{" "}
                  (
                  {formatPercentWithLocale(
                    0.0639,
                    formData.numberFormat || "en-US"
                  )}
                  ) as of{" "}
                  {formatDateByPattern(
                    new Date(2024, 9, 23),
                    formData.dateFormat
                  )}
                </p>
              </div>
              <div className="hidden sm:block ml-4">
                <svg
                  width="140"
                  height="70"
                  viewBox="0 0 140 70"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M 0 55 L 10 52 Q 15 50 20 48 L 25 50 Q 30 52 35 48 L 40 45 Q 45 42 50 44 L 55 46 Q 60 48 65 45 L 70 42 Q 75 38 80 35 L 85 33 Q 90 30 95 28 L 100 25 Q 105 22 110 20 L 115 18 Q 120 15 125 12 L 130 10 L 140 8"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    fill="none"
                    className="text-success"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
          </CardBody>
        </Card>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.3 }}
      >
        <Card className="bg-default-50/10 dark:bg-default-50/10 backdrop-blur-md border border-brand-blue-500/20 shadow-xl">
        <CardBody className="p-8">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Default Currency */}
            <Select
              required
              label="Default Currency"
              selectedKeys={[formData.defaultCurrency]}
              onChange={(e) =>
                setFormData({ ...formData, defaultCurrency: e.target.value })
              }
            >
              {Object.values(Currency).map((currency) => (
                <SelectItem key={currency}>{currency}</SelectItem>
              ))}
            </Select>

            {/* Date Format */}
            <Select
              required
              description="How dates will be displayed throughout the app"
              label="Date Format"
              selectedKeys={[formData.dateFormat]}
              onChange={(e) =>
                setFormData({ ...formData, dateFormat: e.target.value })
              }
            >
              {DATE_FORMATS.map((format) => (
                <SelectItem key={format.value} textValue={format.label}>
                  {format.label} - {format.example}
                </SelectItem>
              ))}
            </Select>

            {/* Number Format */}
            <Select
              required
              description="How numbers and currencies will be formatted"
              label="Number Format"
              selectedKeys={formData.numberFormat ? [formData.numberFormat] : []}
              onChange={(e) =>
                setFormData({ ...formData, numberFormat: e.target.value })
              }
            >
              {NUMBER_FORMATS.map((format) => (
                <SelectItem key={format.value} textValue={format.label}>
                  {format.flag} {format.label}
                </SelectItem>
              ))}
            </Select>

            {/* Locale */}
            <Select
              required
              description="Your preferred language and region"
              label="Locale"
              selectedKeys={formData.locale ? [formData.locale] : []}
              onChange={(e) =>
                setFormData({ ...formData, locale: e.target.value })
              }
            >
              {LOCALES.map((locale) => (
                <SelectItem key={locale.value} textValue={locale.label}>
                  {locale.flag} {locale.label}
                </SelectItem>
              ))}
            </Select>

            {/* Timezone */}
            <Select
              required
              description="Detected from your browser"
              isDisabled
              label="Timezone"
              selectedKeys={formData.timezone ? [formData.timezone] : []}
            >
              <SelectItem key={formData.timezone} textValue={formData.timezone}>
                {formData.timezone}
              </SelectItem>
            </Select>

            <div className="flex gap-4">
              <Button
                className="flex-1"
                type="button"
                variant="flat"
                onPress={() => router.push("/onboarding/initial-net-worth")}
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
      </motion.div>
    </div>
  );
}
