import { redirect } from "next/navigation";

/** Home: la schermata principale dell'app è la Panoramica. */
export default function Home() {
  redirect("/panoramica");
}
