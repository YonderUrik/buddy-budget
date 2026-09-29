"use client";

/**
 * Sezione Sessioni: i dispositivi con un accesso ancora valido. Si può chiudere una sessione o tutte le altre;
 * la corrente si chiude con "Esci". Le sessioni scadute non compaiono (non valgono più).
 */

import { Laptop, Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadError } from "@/components/domain/shared";
import { SESSION_EXPIRES_IN_DAYS } from "@/lib/auth/constants";
import { formatLongDate, formatRelativeTime } from "@/lib/format";
import { useRevokeSessionMutation, useUserSessionsQuery, type UserSessionView } from "@/lib/queries/user-settings";
import { SettingsSection } from "./settings-section";

function SessionRow({ session, onRevoke, revoking }: { session: UserSessionView; onRevoke: () => void; revoking: boolean }) {
  const Icon = session.mobile ? Smartphone : Laptop;
  return (
    <li className="flex items-center gap-3 border-t border-border py-3 first:border-t-0 first:pt-0">
      <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {session.device}
          {session.current && <span className="ml-2 text-xs font-normal text-pos">questo dispositivo</span>}
        </p>
        <p className="text-xs text-muted-foreground">
          Attiva {formatRelativeTime(new Date(session.lastActiveAt))} · scade il {formatLongDate(new Date(session.expiresAt))}
        </p>
      </div>
      {!session.current && (
        <Button type="button" size="sm" variant="outline" onClick={onRevoke} disabled={revoking}>
          {revoking && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          Disconnetti
        </Button>
      )}
    </li>
  );
}

export function SessionsSection() {
  const { data: sessions, isLoading, isError, refetch } = useUserSessionsQuery();
  const revoke = useRevokeSessionMutation();
  const others = sessions?.filter((s) => !s.current).length ?? 0;

  return (
    <SettingsSection
      id="impostazioni-sessioni"
      title="Sessioni attive"
      description={`I dispositivi da cui hai fatto l'accesso. Una sessione scade dopo ${SESSION_EXPIRES_IN_DAYS} giorni senza utilizzo.`}
    >
      {isLoading ? (
        <div className="h-24 animate-pulse rounded-lg bg-muted" aria-busy="true" />
      ) : isError ? (
        <LoadError message="Impossibile caricare le sessioni." onRetry={() => refetch()} />
      ) : (
        <>
          <ul className="flex flex-col">
            {sessions?.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                onRevoke={() => revoke.mutate(session.id)}
                revoking={revoke.isPending && revoke.variables === session.id}
              />
            ))}
          </ul>
          {others > 0 && (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => revoke.mutate(undefined)}
              disabled={revoke.isPending}
            >
              {revoke.isPending && revoke.variables === undefined && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Esci da tutti gli altri dispositivi
            </Button>
          )}
          {revoke.isError && (
            <p className="text-sm text-neg" role="alert">
              {revoke.error.message}
            </p>
          )}
        </>
      )}
    </SettingsSection>
  );
}
