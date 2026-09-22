import { Wallet } from "lucide-react";
import { LoginStory, UpcomingFeatures } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";

/** Layout delle pagine di autenticazione/onboarding: pannello racconto del prodotto (solo desktop) + colonna del form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      <aside className="hidden w-1/2 flex-col justify-between gap-8 bg-primary px-12 py-10 text-primary-foreground lg:flex xl:px-16 [@media(min-height:960px)]:py-14">
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary-foreground text-primary">
            <Wallet className="size-5" aria-hidden="true" />
          </span>
          {BRAND_NAME}
        </div>

        <div className="flex flex-col gap-8">
          <div className="max-w-md">
            <h2 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight text-balance xl:text-5xl">
              I tuoi movimenti, finalmente leggibili.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-primary-foreground/75 [@media(max-height:940px)]:hidden">
              BuddyBudget collega le tue banche, ripulisce e categorizza ogni movimento e ti mostra dove va ogni euro.
            </p>
          </div>

          <LoginStory />
        </div>

        <div className="flex max-w-md flex-col gap-5">
          <UpcomingFeatures />
          <p className="text-xs text-primary-foreground/60">
            Collegamento bancario tramite Open Banking (PSD2), in sola lettura.
          </p>
        </div>
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
