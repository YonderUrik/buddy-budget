"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Checkbox, CheckboxGroup } from "@heroui/checkbox";
import { motion } from "framer-motion";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";
import { FinancialExperienceLevel } from "@/types/user";

const COUNTRIES = [
  { code: "AR", name: "Argentina", flag: "🇦🇷" },
  { code: "AU", name: "Australia", flag: "🇦🇺" },
  { code: "AT", name: "Austria", flag: "🇦🇹" },
  { code: "BE", name: "Belgium", flag: "🇧🇪" },
  { code: "BR", name: "Brazil", flag: "🇧🇷" },
  { code: "CA", name: "Canada", flag: "🇨🇦" },
  { code: "CN", name: "China", flag: "🇨🇳" },
  { code: "DK", name: "Denmark", flag: "🇩🇰" },
  { code: "FI", name: "Finland", flag: "🇫🇮" },
  { code: "FR", name: "France", flag: "🇫🇷" },
  { code: "DE", name: "Germany", flag: "🇩🇪" },
  { code: "IN", name: "India", flag: "🇮🇳" },
  { code: "IE", name: "Ireland", flag: "🇮🇪" },
  { code: "IT", name: "Italy", flag: "🇮🇹" },
  { code: "JP", name: "Japan", flag: "🇯🇵" },
  { code: "MX", name: "Mexico", flag: "🇲🇽" },
  { code: "NL", name: "Netherlands", flag: "🇳🇱" },
  { code: "NZ", name: "New Zealand", flag: "🇳🇿" },
  { code: "NO", name: "Norway", flag: "🇳🇴" },
  { code: "PL", name: "Poland", flag: "🇵🇱" },
  { code: "PT", name: "Portugal", flag: "🇵🇹" },
  { code: "SG", name: "Singapore", flag: "🇸🇬" },
  { code: "ZA", name: "South Africa", flag: "🇿🇦" },
  { code: "KR", name: "South Korea", flag: "🇰🇷" },
  { code: "ES", name: "Spain", flag: "🇪🇸" },
  { code: "SE", name: "Sweden", flag: "🇸🇪" },
  { code: "CH", name: "Switzerland", flag: "🇨🇭" },
  { code: "GB", name: "United Kingdom", flag: "🇬🇧" },
  { code: "US", name: "United States", flag: "🇺🇸" },
];

const INCOME_RANGES = [
  { value: "0-2000", label: "$0 - $2,000" },
  { value: "2000-4000", label: "$2,000 - $4,000" },
  { value: "4000-6000", label: "$4,000 - $6,000" },
  { value: "6000-8000", label: "$6,000 - $8,000" },
  { value: "8000-10000", label: "$8,000 - $10,000" },
  { value: "10000+", label: "$10,000+" },
];

const PRIMARY_GOALS = [
  { value: "save_money", label: "Save Money" },
  { value: "reduce_debt", label: "Reduce Debt" },
  { value: "invest", label: "Invest for Future" },
  { value: "track_expenses", label: "Track Expenses" },
  { value: "budget", label: "Create Budget" },
  { value: "retirement", label: "Retirement Planning" },
  { value: "buy_home", label: "Buy a Home" },
  { value: "emergency_fund", label: "Build Emergency Fund" },
];

export default function UserProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    occupation: "",
    country: "",
    financialExperienceLevel: "" as FinancialExperienceLevel | "",
    monthlyIncomeRange: "",
    primaryGoals: [] as string[],
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
          financialExperienceLevel: formData.financialExperienceLevel || null,
          onboardingStep: OnboardingStep.INITIAL_NET_WORTH,
          onboardingStartedAt: new Date(),
        }),
      });

      if (!response.ok) throw new Error("Failed to update profile");

      await update({
        onboardingStep: OnboardingStep.INITIAL_NET_WORTH,
      });

      router.push("/onboarding/initial-net-worth");
    } catch (error) {
      console.error("Error updating profile:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8 px-4 py-12">
      <motion.div
        animate={{ opacity: 1, y: 0 }}
        className="text-center max-w-2xl"
        initial={{ opacity: 0, y: 20 }}
        transition={{ duration: 0.5 }}
      >
        <h1 className={title({ size: "lg" })}>
          Welcome, {session?.user?.name?.split(" ")[0] || "there"}!
        </h1>
        <p className={subtitle({ class: "mt-4" })}>
          Let&apos;s get to know you better to personalize your experience
        </p>
      </motion.div>

      <motion.div
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-2xl"
        initial={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <Card className="bg-default-50/10 dark:bg-default-50/10 backdrop-blur-md border border-brand-blue-500/20 shadow-xl">
          <CardBody className="p-8">
            <form className="space-y-6" onSubmit={handleSubmit}>
              {/* Occupation */}
              <Input
                required
                label="Occupation"
                placeholder="e.g., Software Engineer, Teacher, Student"
                value={formData.occupation}
                onChange={(e) =>
                  setFormData({ ...formData, occupation: e.target.value })
                }
              />

              {/* Country */}
              <Select
                required
                label="Country"
                placeholder="Select your country"
                selectedKeys={formData.country ? [formData.country] : []}
                onChange={(e) =>
                  setFormData({ ...formData, country: e.target.value })
                }
              >
                {COUNTRIES.map((country) => (
                  <SelectItem key={country.code} textValue={country.name}>
                    {country.flag} {country.name}
                  </SelectItem>
                ))}
              </Select>

              {/* Financial Experience Level */}
              <Select
                required
                description="How would you describe your overall financial experience?"
                label="Financial Experience Level"
                placeholder="Select your experience level"
                selectedKeys={
                  formData.financialExperienceLevel
                    ? [formData.financialExperienceLevel]
                    : []
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    financialExperienceLevel: e.target
                      .value as FinancialExperienceLevel,
                  })
                }
              >
                <SelectItem key="BEGINNER">
                  Beginner - New to managing finances, little experience with
                  budgeting or saving
                </SelectItem>
                <SelectItem key="DEVELOPING">
                  Developing - Learning the basics, building financial habits
                </SelectItem>
                <SelectItem key="INTERMEDIATE">
                  Intermediate - Comfortable with budgeting, regular saving
                  habits
                </SelectItem>
                <SelectItem key="ADVANCED">
                  Advanced - Strong financial management skills, good accounting
                  knowledge
                </SelectItem>
                <SelectItem key="EXPERT">
                  Expert - Professional or extensive financial/accounting
                  experience
                </SelectItem>
              </Select>

              {/* Monthly Income Range */}
              <Select
                required
                label="Monthly Income Range"
                placeholder="Select your income range"
                selectedKeys={
                  formData.monthlyIncomeRange
                    ? [formData.monthlyIncomeRange]
                    : []
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    monthlyIncomeRange: e.target.value,
                  })
                }
              >
                {INCOME_RANGES.map((range) => (
                  <SelectItem key={range.value}>{range.label}</SelectItem>
                ))}
              </Select>

              {/* Primary Goals */}
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="primary-goals">
                  What are your primary financial goals?
                </label>
                <p className="text-xs text-default-500">
                  Select all that apply
                </p>
                <CheckboxGroup
                  id="primary-goals"
                  value={formData.primaryGoals}
                  onChange={(values) =>
                    setFormData({
                      ...formData,
                      primaryGoals: values as string[],
                    })
                  }
                >
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                    {PRIMARY_GOALS.map((goal) => (
                      <Checkbox key={goal.value} value={goal.value}>
                        {goal.label}
                      </Checkbox>
                    ))}
                  </div>
                </CheckboxGroup>
              </div>

              {/* Submit Button */}
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
      </motion.div>
    </div>
  );
}
