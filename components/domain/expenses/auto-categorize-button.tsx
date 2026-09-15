/** Bottone "Categorizza automaticamente": link alla pagina dedicata di revisione delle proposte (`/categorizza`). */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { Category } from "@/lib/db/schema/categories";

export interface AutoCategorizeButtonProps {
  categories: Category[];
  currency: string;
}

export function AutoCategorizeButton({ categories, currency }: AutoCategorizeButtonProps) {
  void categories;
  void currency;
  return (
    <Link href="/categorizza" className={buttonVariants({ variant: "outline", size: "sm" })}>
      Categorizza automaticamente
    </Link>
  );
}
