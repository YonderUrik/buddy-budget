"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { authClient } from "@/lib/auth/client";
import { Loader2, MailCheck } from "lucide-react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    await authClient.signIn.magicLink({ email, callbackURL: "/" });
    setSent(true);
    setLoading(false);
  }

  async function handleGoogle() {
    await authClient.signIn.social({ provider: "google", callbackURL: "/" });
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-pos-soft text-pos">
          <MailCheck className="size-8" />
        </div>
        <h1 className="font-heading text-3xl font-bold tracking-tight">Controlla la tua email</h1>
        <p className="mt-2 text-text-2">
          Abbiamo inviato un link di accesso a <strong className="text-foreground">{email}</strong>.
          <br />Il link scade in 10 minuti.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col space-y-6">
      <div className="flex flex-col space-y-2 text-center">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Accedi</h1>
        <p className="text-sm text-text-2">
          Inserisci la tua email per accedere al tuo account
        </p>
      </div>
      
      <div className="grid gap-6">
        <form onSubmit={handleMagicLink} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="sr-only">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="nome@esempio.it"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="h-11"
              disabled={loading}
            />
          </div>
          <Button type="submit" className="h-11 w-full text-base" disabled={loading}>
            {loading && <Loader2 className="mr-2 size-5 animate-spin" />}
            {loading ? "Invio in corso…" : "Continua con email"}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <Separator className="w-full" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-text-3">oppure continua con</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="h-11 w-full text-base font-normal shadow-sm transition-shadow hover:shadow-md"
          type="button"
          onClick={handleGoogle}
        >
          <svg viewBox="0 0 24 24" className="mr-2 size-5" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Google
        </Button>
      </div>
    </div>
  );
}
