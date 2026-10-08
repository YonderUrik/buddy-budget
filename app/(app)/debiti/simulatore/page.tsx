import { redirect } from "next/navigation";

/** Il Simulatore non è più una pagina: gli scenari stanno nel dettaglio di ogni finanziamento ("E se…"). */
export default function SimulatorePage() {
  redirect("/debiti/finanziamenti");
}
