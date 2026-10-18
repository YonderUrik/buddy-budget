"use client";

import * as React from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { START_QUERY_KEY } from "@/lib/queries/start-key";
import type { StartStatus } from "@/lib/start";

/**
 * Wrapper around TanStack Query, with one QueryClient for the whole browser session. While the first steps are not
 * complete, every successful write refreshes them, so a step done anywhere in the app is noticed right away.
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(() => {
    const client: QueryClient = new QueryClient({
      mutationCache: new MutationCache({
        onSuccess: () => {
          const start = client.getQueryData<StartStatus>(START_QUERY_KEY);
          if (start && !start.completed) void client.invalidateQueries({ queryKey: START_QUERY_KEY });
        },
      }),
    });
    return client;
  });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
