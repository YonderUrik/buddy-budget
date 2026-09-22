import { Wallet } from "lucide-react";
import { LoginShowcase } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";

/** Layout delle pagine di autenticazione/onboarding: pannello prodotto (solo desktop) + colonna del form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-1/2 flex-col justify-between gap-12 bg-primary p-12 text-primary-foreground lg:flex xl:p-16">
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          {BRAND_NAME}
        </div>

        <div className="max-w-md">
          <h2 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight text-balance xl:text-5xl">
            Tutti i tuoi conti. Un solo numero.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-primary-foreground/75">
            Collega le tue banche, lascia che i movimenti si categorizzino da soli e scopri dove va ogni euro.
          </p>
        </div>

        <LoginShowcase />

        <p className="text-xs text-primary-foreground/60">
          Collegamento bancario tramite Open Banking (PSD2), in sola lettura.
        </p>
      </aside>

      <main className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center gap-2 p-6 font-heading text-lg font-bold text-primary lg:hidden">
          <Wallet className="size-5" aria-hidden="true" />
          {BRAND_NAME}
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12 sm:px-12 lg:py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
