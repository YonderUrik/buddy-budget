"use client";

import { useSession } from "next-auth/react";

import { OnboardingStep } from "@/lib/auth";

const STEP_PROGRESS = {
  [OnboardingStep.NOT_STARTED]: 0,
  [OnboardingStep.WELCOME]: 0,
  [OnboardingStep.USER_PROFILE]: 25,
  [OnboardingStep.INITIAL_NET_WORTH]: 50,
  [OnboardingStep.PREFERENCES]: 75,
  [OnboardingStep.COMPLETED]: 100,
};

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session } = useSession();
  const progress = session?.user?.onboardingStep
    ? STEP_PROGRESS[session.user.onboardingStep]
    : 0;

  return (
    <div className="max-w-2xl mx-auto py-12 px-4">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="h-2 bg-default-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-brand-blue-500 to-brand-gold-500 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-sm text-default-500 mt-2 text-center">
          {progress}% Complete
        </p>
      </div>

      {children}
    </div>
  );
}
