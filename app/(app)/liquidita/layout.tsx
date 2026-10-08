import { LiquidityShell } from "@/components/domain/liquidity";

export default function LiquiditaLayout({ children }: { children: React.ReactNode }) {
  return <LiquidityShell>{children}</LiquidityShell>;
}
