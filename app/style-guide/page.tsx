import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { StatCard } from "@/components/stat-card";
import { ThemeToggle } from "@/components/theme-toggle";

const colorSwatches: { name: string; token: string }[] = [
  { name: "Background", token: "var(--background)" },
  { name: "Foreground", token: "var(--foreground)" },
  { name: "Card / Surface", token: "var(--card)" },
  { name: "Primary / Accent", token: "var(--primary)" },
  { name: "Secondary", token: "var(--secondary)" },
  { name: "Muted", token: "var(--muted)" },
  { name: "Border", token: "var(--border)" },
  { name: "Positivo", token: "var(--pos)" },
  { name: "Negativo", token: "var(--neg)" },
  { name: "Testo secondario", token: "var(--text-2)" },
  { name: "Testo terziario", token: "var(--text-3)" },
];

const radiusSwatches: { name: string; className: string }[] = [
  { name: "sm — 6px", className: "rounded-sm" },
  { name: "md — 8px", className: "rounded-md" },
  { name: "lg — 11px", className: "rounded-lg" },
  { name: "xl — 16px", className: "rounded-xl" },
  { name: "2xl — 18px", className: "rounded-2xl" },
];

export default function StyleGuidePage() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-12">
      <header className="mb-12 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-3xl font-medium">BuddyBudget</h1>
          <p className="text-sm text-muted-foreground">
            Design system — colori, tipografia e componenti base
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-xl font-medium">Colori</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {colorSwatches.map((swatch) => (
            <div key={swatch.name} className="space-y-2">
              <div
                className="h-16 rounded-lg border border-border"
                style={{ background: swatch.token }}
              />
              <p className="text-sm font-medium">{swatch.name}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {swatch.token}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-xl font-medium">Tipografia</h2>
        <Card>
          <CardContent className="space-y-4">
            <div>
              <p className="font-heading text-4xl font-medium">
                Patrimonio netto
              </p>
              <p className="text-xs text-muted-foreground">
                font-heading (Space Grotesk) — 4xl / medium
              </p>
            </div>
            <div>
              <p className="font-heading text-2xl font-medium">
                Saldo disponibile
              </p>
              <p className="text-xs text-muted-foreground">
                font-heading (Space Grotesk) — 2xl / medium
              </p>
            </div>
            <div>
              <p className="text-base">
                Testo corpo standard per etichette e descrizioni.
              </p>
              <p className="text-xs text-muted-foreground">
                font-sans (Hanken Grotesk) — base
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">
                Testo secondario per didascalie e metadati.
              </p>
              <p className="text-xs text-muted-foreground">
                font-sans (Hanken Grotesk) — sm / muted-foreground
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-xl font-medium">
          Border radius
        </h2>
        <div className="flex flex-wrap gap-4">
          {radiusSwatches.map((swatch) => (
            <div key={swatch.name} className="space-y-2 text-center">
              <div
                className={`size-16 border border-border bg-secondary ${swatch.className}`}
              />
              <p className="text-xs text-muted-foreground">{swatch.name}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-xl font-medium">Bottoni</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="default">Primario</Button>
          <Button variant="secondary">Secondario</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Elimina</Button>
          <Button variant="link">Link</Button>
        </div>
        <Separator className="my-4" />
        <div className="flex flex-wrap items-center gap-3">
          <Button size="xs">Extra small</Button>
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-xl font-medium">Badge</h2>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="default">Default</Badge>
          <Badge variant="secondary">Alimentari</Badge>
          <Badge variant="outline">Trasporti</Badge>
          <Badge variant="destructive">Scaduto</Badge>
          <Badge className="bg-pos-soft text-pos">+120,00 €</Badge>
          <Badge className="bg-neg-soft text-neg">-45,50 €</Badge>
        </div>
      </section>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-xl font-medium">Card</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Conto corrente</CardTitle>
              <CardDescription>Aggiornato oggi</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="font-heading text-2xl font-medium">2.480,00 €</p>
            </CardContent>
          </Card>
          <StatCard
            label="Spese di questo mese"
            value={-845}
            subtitle="rispetto a 720 € il mese scorso"
          />
        </div>
      </section>

      <section>
        <h2 className="mb-4 font-heading text-xl font-medium">Form</h2>
        <Card className="max-w-sm">
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount">Importo</Label>
              <Input id="amount" placeholder="0,00 €" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note">Nota</Label>
              <Input id="note" placeholder="Spesa al supermercato" />
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
