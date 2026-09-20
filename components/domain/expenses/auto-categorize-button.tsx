/** Bottone "Categorizza automaticamente": link alla pagina dedicata di revisione delle proposte (`/categorizza`). */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export function AutoCategorizeButton() {
  return (
    <Link href="/categorizza" className={buttonVariants({ variant: "outline", size: "sm" })}>
      Categorizza automaticamente
    </Link>
  );
}
