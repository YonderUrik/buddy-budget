"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const SUPPORTED_CURRENCIES = [
  { value: "EUR", label: "Euro (EUR)" },
  { value: "USD", label: "Dollaro USA (USD)" },
  { value: "GBP", label: "Sterlina britannica (GBP)" },
  { value: "CHF", label: "Franco svizzero (CHF)" },
] as const;

export default function OnboardingPage() {
  const router = useRouter();
  const [currency, setCurrency] = useState("EUR");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const response = await fetch("/api/user/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currency }),
    });

    if (response.ok) {
      router.push("/");
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-2xl">Benvenuto in BuddyBudget</CardTitle>
          <CardDescription>
            Scegli la tua valuta principale per iniziare.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currency">Valuta</Label>
              <Select value={currency} onValueChange={(v) => { if (v) setCurrency(v); }}>
                <SelectTrigger id="currency" className="w-full">
                  <SelectValue placeholder="Seleziona valuta" />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Salvataggio…" : "Inizia"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
