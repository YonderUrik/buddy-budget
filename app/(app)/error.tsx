"use client";

import { PageError } from "@/components/domain/shared";

/** Error boundary delle schermate dell'app: la sidebar resta, il contenuto lascia posto a «Riprova» e alla segnalazione. */
export default function AppError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <PageError error={error} onRetry={retry} kind="sezione" />;
}
