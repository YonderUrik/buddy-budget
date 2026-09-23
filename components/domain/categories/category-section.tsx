/** Sezione della pagina Categorie: intestazione (pallino colore gruppo, titolo, descrizione breve) e righe categoria. */

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CategorySectionProps {
  title: string;
  description?: string;
  /** Classe Tailwind del pallino colore; omessa per sezioni senza gruppo (es. Entrate). */
  dotClassName?: string;
  children: React.ReactNode;
}

export function CategorySection({ title, description, dotClassName, children }: CategorySectionProps) {
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          {dotClassName && <span aria-hidden="true" className={cn("size-2.5 rounded-full", dotClassName)} />}
          {title}
        </h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Card className="p-0">{children}</Card>
    </section>
  );
}
