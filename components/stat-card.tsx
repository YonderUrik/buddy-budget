"use client";


import { useLocalization } from "@/lib/localization/provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";



interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ label, value, subtitle, className }: StatCardProps) {
  const { locale: formattingLocale } = useLocalization();
  const formatAmount = (amount: number) => formatCurrency(amount, "EUR", { locale: formattingLocale, maximumFractionDigits: 0 });

  const { t: tr } = useLocalization();
  const isNegative = value < 0;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {tr(label)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "font-heading text-3xl font-medium tabular-nums",
            isNegative ? "text-neg" : "text-pos"
          )}
        >
          {formatAmount(value)}
        </p>
        {subtitle ? (
          <p className="mt-1 text-sm text-muted-foreground">{tr(subtitle)}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
