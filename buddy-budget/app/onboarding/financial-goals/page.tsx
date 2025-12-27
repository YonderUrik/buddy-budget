"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";
import { Input } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";

import { title, subtitle } from "@/components/primitives";
import { OnboardingStep } from "@/lib/auth";
import { FinancialGoal } from "@/types/user";

export default function FinancialGoalsPage() {
  const { update } = useSession();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [goals, setGoals] = useState<FinancialGoal[]>([
    {
      id: crypto.randomUUID(),
      type: "savings",
      name: "",
      targetAmount: 0,
    },
  ]);

  const addGoal = () => {
    setGoals([
      ...goals,
      {
        id: crypto.randomUUID(),
        type: "savings",
        name: "",
        targetAmount: 0,
      },
    ]);
  };

  const updateGoal = (id: string, updates: Partial<FinancialGoal>) => {
    setGoals(
      goals.map((goal) => (goal.id === id ? { ...goal, ...updates } : goal)),
    );
  };

  const removeGoal = (id: string) => {
    setGoals(goals.filter((goal) => goal.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/user/onboarding", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financialGoals: goals.filter((g) => g.name && g.targetAmount > 0),
          onboardingStep: OnboardingStep.INITIAL_NET_WORTH,
        }),
      });

      if (!response.ok) throw new Error("Failed to update goals");

      await update({
        onboardingStep: OnboardingStep.INITIAL_NET_WORTH,
      });

      router.push("/onboarding/initial-net-worth");
    } catch (error) {
      console.error("Error updating goals:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className={title({ size: "md" })}>Set Your Financial Goals</h1>
        <p className={subtitle({ class: "mt-2" })}>
          What do you want to achieve?
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        {goals.map((goal, index) => (
          <Card key={goal.id}>
            <CardBody className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Goal {index + 1}</h3>
                {goals.length > 1 && (
                  <Button
                    color="danger"
                    size="sm"
                    variant="flat"
                    onClick={() => removeGoal(goal.id)}
                  >
                    Remove
                  </Button>
                )}
              </div>

              <div className="space-y-4">
                <Select
                  label="Goal Type"
                  selectedKeys={[goal.type]}
                  onChange={(e) =>
                    updateGoal(goal.id, {
                      type: e.target.value as FinancialGoal["type"],
                    })
                  }
                >
                  <SelectItem key="savings" value="savings">
                    Savings
                  </SelectItem>
                  <SelectItem key="debt_payoff" value="debt_payoff">
                    Debt Payoff
                  </SelectItem>
                  <SelectItem key="investment" value="investment">
                    Investment
                  </SelectItem>
                  <SelectItem key="net_worth" value="net_worth">
                    Net Worth
                  </SelectItem>
                  <SelectItem key="custom" value="custom">
                    Custom
                  </SelectItem>
                </Select>

                <Input
                  required
                  label="Goal Name"
                  placeholder="e.g., Emergency Fund"
                  value={goal.name}
                  onChange={(e) =>
                    updateGoal(goal.id, { name: e.target.value })
                  }
                />

                <Input
                  required
                  label="Target Amount"
                  placeholder="0"
                  startContent={<span className="text-default-400">$</span>}
                  type="number"
                  value={goal.targetAmount.toString()}
                  onChange={(e) =>
                    updateGoal(goal.id, {
                      targetAmount: parseFloat(e.target.value) || 0,
                    })
                  }
                />
              </div>
            </CardBody>
          </Card>
        ))}

        <Button
          className="w-full"
          type="button"
          variant="bordered"
          onClick={addGoal}
        >
          Add Another Goal
        </Button>

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
            Continue
          </Button>
        </div>
      </form>
    </div>
  );
}
