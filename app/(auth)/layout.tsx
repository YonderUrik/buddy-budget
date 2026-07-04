/** Layout passthrough per le pagine di autenticazione: nessuna AppShell né sidebar. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
