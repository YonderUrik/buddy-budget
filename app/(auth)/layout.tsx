import { Wallet } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Panel - Hidden on mobile */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between bg-primary p-12 text-primary-foreground relative overflow-hidden">
        {/* Soft decorative background effect */}
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,var(--color-pos-soft),transparent_50%)]" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-2 font-heading text-2xl font-bold">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground text-primary shadow-sm">
              <Wallet className="size-6" />
            </div>
            BuddyBudget
          </div>
        </div>
        
        <div className="relative z-10 max-w-md space-y-4">
          <h2 className="font-heading text-4xl font-bold leading-tight">
            Prendi il controllo delle tue finanze.
          </h2>
          <p className="text-lg opacity-90">
            Traccia le tue spese, gestisci i tuoi conti e pianifica il tuo futuro in modo semplice, intelligente e su misura per te.
          </p>
        </div>
      </div>

      {/* Right Panel - Form Container */}
      <div className="flex w-full lg:w-1/2 flex-col">
        {/* Mobile Header (visible only on small screens) */}
        <div className="flex items-center gap-2 p-6 lg:hidden font-heading text-xl font-bold text-primary">
          <Wallet className="size-6" />
          BuddyBudget
        </div>

        <div className="flex flex-1 items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-sm">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
