import { BrandLink, LoginMosaic, NewFeatureNote, UpcomingFeatures } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";

/** Layout delle pagine di autenticazione/onboarding: pannello racconto del prodotto (solo desktop) + colonna del form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Stessa superficie neutra della sidebar (--sidebar): il brand vive nel logo, non nello sfondo. */}
      <aside className="hidden w-1/2 flex-col justify-between gap-6 border-r border-sidebar-border bg-sidebar px-12 py-10 text-sidebar-foreground lg:flex xl:px-16 [@media(max-height:940px)]:py-7 [@media(min-height:1200px)]:py-14">
        <BrandLink name={BRAND_NAME} className="text-xl" showBackLink />

        <div className="flex flex-col gap-6">
          <div className="max-w-xl">
            <h2 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight text-balance xl:text-5xl">
              Conti, investimenti, pensione e debiti insieme.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/75 [@media(max-height:1100px)]:hidden">
              Collega le tue banche e vedi dove va ogni euro. Il patrimonio netto è la somma di conti, investimenti e fondo pensione, meno i debiti.
            </p>
          </div>

          <LoginMosaic />
        </div>

        <div className="flex max-w-md flex-col gap-5">
          <NewFeatureNote />
          <UpcomingFeatures className="[@media(max-height:820px)]:hidden" />
          <p className="text-xs text-sidebar-foreground/60">
            Collegamento bancario tramite Open Banking (PSD2), in sola lettura.
          </p>
        </div>
      </aside>

      <main className="flex w-full flex-col lg:w-1/2">
        <div className="p-6 lg:hidden">
          <BrandLink name={BRAND_NAME} className="gap-2 text-lg text-primary" markClassName="h-5 w-auto" showBackLink />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12 sm:px-12 lg:py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
