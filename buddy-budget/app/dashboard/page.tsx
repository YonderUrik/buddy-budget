"use client";

import { useSession } from "next-auth/react";
import { signOut } from "next-auth/react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

import { title, subtitle } from "@/components/primitives";

export default function DashboardPage() {
  const { data: session } = useSession();

  throw new Error("Test error frontend");

  return (
    <div className="max-w-4xl mx-auto py-12 px-4 space-y-8">
      <div className="text-center">
        <h1 className={title({ size: "lg" })}>
          Welcome, {session?.user?.name}!
        </h1>
        <p className={subtitle({ class: "mt-4" })}>
          You have successfully completed onboarding.
        </p>
      </div>

      <Card>
        <CardBody className="p-8">
          <div className="space-y-4">
            <h2 className="text-2xl font-bold">Your Dashboard</h2>
            <p className="text-default-600">
              This is your protected dashboard. You can only access this page
              after completing the onboarding process.
            </p>

            <div className="pt-4">
              <h3 className="font-semibold mb-2">User Information:</h3>
              <ul className="space-y-1 text-default-600">
                <li>Email: {session?.user?.email}</li>
                <li>Provider: {session?.user?.provider || "N/A"}</li>
                <li>
                  Onboarding Status:{" "}
                  {session?.user?.onboardingCompleted
                    ? "Completed"
                    : "In Progress"}
                </li>
              </ul>
            </div>

            <div className="pt-6">
              <Button color="danger" onClick={() => signOut()}>
                Sign Out
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
