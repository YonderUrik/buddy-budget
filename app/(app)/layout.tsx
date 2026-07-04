import { AppShell } from "@/components/layout";

/** Layout per tutte le pagine dell'app autenticate: monta AppShell con sidebar. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
