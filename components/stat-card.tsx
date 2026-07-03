import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function formatAmount(value: number) {
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

interface StatCardProps {
  label: string;
  value: number;
  subtitle?: string;
  className?: string;
}

export function StatCard({ label, value, subtitle, className }: StatCardProps) {
  const isNegative = value < 0;

  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
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
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
