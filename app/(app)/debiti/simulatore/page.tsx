import { redirect } from "next/navigation";

/** Il Simulatore non è più una pagina: gli scenari stanno nel dettaglio di ogni finanziamento ("E se…") e delle linee di credito. */
export default function SimulatorePage() {
  redirect("/debiti/finanziamenti");
}
