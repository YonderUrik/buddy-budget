import { redirect } from "next/navigation";

/** Le sei schede sono diventate quattro domande in una pagina: i vecchi indirizzi portano alla sezione che le contiene. */
export default function Page() {
  redirect("/analitiche#dove-sono");
}
