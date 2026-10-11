import { SupportPage } from "@/components/domain/support";

/** Aiuto e segnalazioni. `?da=` è la pagina di provenienza (contesto allegato), `?tipo=` preseleziona il tipo. */
export default async function AiutoPage({ searchParams }: { searchParams: Promise<{ da?: string; tipo?: string }> }) {
  const { da, tipo } = await searchParams;
  return <SupportPage from={da ?? null} kind={tipo ?? null} />;
}
