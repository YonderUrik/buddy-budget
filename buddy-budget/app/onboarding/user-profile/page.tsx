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
import {
  FinanceExperience,
  AccountingExperience,
  SavingHabits,
} from "@/types/user";

const COUNTRIES = [
  { code: "US", name: "United States" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "AU", name: "Australia" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "IT", name: "Italy" },
  { code: "ES", name: "Spain" },
  { code: "NL", name: "Netherlands" },
  { code: "BE", name: "Belgium" },
  { code: "CH", name: "Switzerland" },
  { code: "AT", name: "Austria" },
  { code: "IE", name: "Ireland" },
  { code: "PT", name: "Portugal" },
  { code: "SE", name: "Sweden" },
  { code: "DK", name: "Denmark" },
  { code: "NO", name: "Norway" },
  { code: "FI", name: "Finland" },
  { code: "PL", name: "Poland" },
  { code: "IN", name: "India" },
  { code: "CN", name: "China" },
  { code: "JP", name: "Japan" },
  { code: "KR", name: "South Korea" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "AR", name: "Argentina" },
  { code: "ZA", name: "South Africa" },
  { code: "SG", name: "Singapore" },
  { code: "NZ", name: "New Zealand" },
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
    financeExperience: "" as FinanceExperience | "",
    accountingExperience: "" as AccountingExperience | "",
    savingHabits: "" as SavingHabits | "",
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
          financeExperience: formData.financeExperience || null,
          accountingExperience: formData.accountingExperience || null,
          savingHabits: formData.savingHabits || null,
          onboardingStep: OnboardingStep.FINANCIAL_GOALS,
          onboardingStartedAt: new Date(),
        }),
      });

      if (!response.ok) throw new Error("Failed to update profile");

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
                  <SelectItem key={country.code}>{country.name}</SelectItem>
                ))}
              </Select>

              {/* Finance Experience */}
              <Select
                required
                description="How comfortable are you with personal finance?"
                label="Finance Experience"
                placeholder="Select your experience level"
                selectedKeys={
                  formData.financeExperience ? [formData.financeExperience] : []
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    financeExperience: e.target.value as FinanceExperience,
                  })
                }
              >
                <SelectItem key="BEGINNER">
                  Beginner - Just starting out
                </SelectItem>
                <SelectItem key="INTERMEDIATE">
                  Intermediate - Have some knowledge
                </SelectItem>
                <SelectItem key="ADVANCED">
                  Advanced - Very comfortable
                </SelectItem>
                <SelectItem key="EXPERT">
                  Expert - Professional level
                </SelectItem>
              </Select>

              {/* Accounting Experience */}
              <Select
                required
                description="Do you have accounting or bookkeeping experience?"
                label="Accounting Experience"
                placeholder="Select your experience level"
                selectedKeys={
                  formData.accountingExperience
                    ? [formData.accountingExperience]
                    : []
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    accountingExperience: e.target
                      .value as AccountingExperience,
                  })
                }
              >
                <SelectItem key="NONE">None - No experience</SelectItem>
                <SelectItem key="BASIC">
                  Basic - Can track simple transactions
                </SelectItem>
                <SelectItem key="INTERMEDIATE">
                  Intermediate - Comfortable with reconciliation
                </SelectItem>
                <SelectItem key="PROFESSIONAL">
                  Professional - Certified or professional level
                </SelectItem>
              </Select>

              {/* Saving Habits */}
              <Select
                required
                description="How often do you save money?"
                label="Saving Habits"
                placeholder="Select your saving pattern"
                selectedKeys={
                  formData.savingHabits ? [formData.savingHabits] : []
                }
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    savingHabits: e.target.value as SavingHabits,
                  })
                }
              >
                <SelectItem key="NO_SAVINGS">
                  No Savings - Living paycheck to paycheck
                </SelectItem>
                <SelectItem key="OCCASIONAL">
                  Occasional - Save when possible
                </SelectItem>
                <SelectItem key="MONTHLY">
                  Monthly - Save a fixed amount regularly
                </SelectItem>
                <SelectItem key="AUTOMATED">
                  Automated - Automatic transfers to savings
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
                Continue to Financial Goals
              </Button>
            </form>
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
}
