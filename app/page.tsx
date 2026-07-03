/**
 * Home — placeholder
 *
 * Questa pagina sarà sostituita dalla schermata "Panoramica" quando
 * verrà implementata. Per ora mostra un messaggio di avvio.
 */

export default function Home() {
  return (
    <div className="flex flex-1 h-full items-center justify-center p-8">
      <div className="text-center space-y-3">
        <p className="font-heading text-2xl font-medium text-foreground">
          Benvenuto in BuddyBudget
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Il design system è pronto. Le schermate dell&apos;app sono in arrivo.
          Visita{" "}
          <a href="/style-guide" className="text-primary underline underline-offset-2">
            /style-guide
          </a>{" "}
          per esplorare i componenti.
        </p>
      </div>
    </div>
  );
}
