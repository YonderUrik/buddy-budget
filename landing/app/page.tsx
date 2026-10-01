import { FEATURES } from "@features";

/** URL dell'app: tutti i pulsanti "Accedi"/"Inizia" della landing puntano qui. */
const APP_URL = "https://app.buddybudget.io";

/** Segnaposto: la pagina vera la costruisce il thread dedicato alla landing. */
export default function LandingPage() {
  return (
    <main>
      <h1>BuddyBudget</h1>
      <p>{FEATURES.length} funzionalità nel catalogo condiviso.</p>
      <a href={`${APP_URL}/login?utm_source=landing`}>Accedi</a>
    </main>
  );
}
