import { redirect } from "next/navigation";

/** La scheda Titoli non esiste più: i titoli si aprono dalle Posizioni o con la ricerca nel Portafoglio. Vecchi link e segnalibri finiscono lì. */
export default function TitoliPage() {
  redirect("/investimenti");
}
