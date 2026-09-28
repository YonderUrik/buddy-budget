import Image from "next/image";
import { LoginStory, NewFeatureNote, UpcomingFeatures } from "@/components/domain/auth";

const BRAND_NAME = "BuddyBudget";

/** Layout delle pagine di autenticazione/onboarding: pannello racconto del prodotto (solo desktop) + colonna del form. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-background">
      {/* Stessa superficie neutra della sidebar (--sidebar): il brand vive nel logo, non nello sfondo. */}
      <aside className="hidden w-1/2 flex-col justify-between gap-8 border-r border-sidebar-border bg-sidebar px-12 py-10 text-sidebar-foreground lg:flex xl:px-16 [@media(min-height:960px)]:py-14">
        <div className="flex items-center gap-2.5 font-heading text-xl font-bold">
          <Image src="/brand/logo-mark.svg" alt="" width={24} height={29} className="h-8 w-auto" aria-hidden="true" />
          {BRAND_NAME}
        </div>

        <div className="flex flex-col gap-8">
          <div className="max-w-md">
            <h2 className="font-heading text-4xl font-medium leading-[1.05] tracking-tight text-balance xl:text-5xl">
              I tuoi movimenti, finalmente leggibili.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-sidebar-foreground/75 [@media(max-height:940px)]:hidden">
              BuddyBudget collega le tue banche, ripulisce e categorizza ogni movimento, segue i tuoi investimenti e ti mostra dove va ogni euro.
            </p>
          </div>

          <LoginStory />
        </div>

        <div className="flex max-w-md flex-col gap-5">
          <NewFeatureNote />
          <UpcomingFeatures />
          <p className="text-xs text-sidebar-foreground/60">
            Collegamento bancario tramite Open Banking (PSD2), in sola lettura.
          </p>
        </div>
      </aside>

      <main className="flex w-full flex-col lg:w-1/2">
        <div className="flex items-center gap-2 p-6 font-heading text-lg font-bold text-primary lg:hidden">
          <Image src="/brand/logo-mark.svg" alt="" width={20} height={24} className="h-5 w-auto" aria-hidden="true" />
          {BRAND_NAME}
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-12 sm:px-12 lg:py-12">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </main>
    </div>
  );
}
