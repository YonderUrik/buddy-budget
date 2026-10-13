"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Zona pericolosa: reset di tutti i dati, disattivazione (eliminazione dopo il periodo di ripensamento) ed
 * eliminazione immediata. Ogni azione chiede un accesso recente e una conferma esplicita; a lavoro fatto si
 * ricarica la pagina di destinazione per non lasciare in cache dati che non esistono più.
 */

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { track } from "@/lib/analytics";
import { ACCOUNT_DELETED_QUERY, DEACTIVATION_GRACE_DAYS, RESET_CONFIRMATION_WORD } from "@/lib/account/constants";
import {
  useDeactivateAccountMutation,
  useDeleteAccountMutation,
  useResetAccountMutation,
  type UserSettings,
} from "@/lib/queries/user-settings";
import { DangerActionDialog } from "./danger-action-dialog";
import { TriangleAlert } from "lucide-react";
import { SettingsSection } from "./settings-section";

export interface DangerZoneSectionProps {
  settings: UserSettings;
  recentLogin: boolean;
}

/** Porta a `path` ricaricando l'app: cache delle query e sessione vengono rilette da zero. */
function hardNavigate(path: string) {
  window.location.assign(path);
}

export function DangerZoneSection({ settings, recentLogin }: DangerZoneSectionProps) {
  const { t: tr } = useLocalization();
  const reset = useResetAccountMutation();
  const deactivate = useDeactivateAccountMutation();
  const remove = useDeleteAccountMutation();
  const [resetWord, setResetWord] = React.useState("");
  const [deleteEmail, setDeleteEmail] = React.useState("");
  const common = { recentLogin, email: settings.email, googleLinked: settings.googleLinked };
  const emailMatches = deleteEmail.trim().toLowerCase() === settings.email.toLowerCase();

  return (
    <SettingsSection
      id="impostazioni-zona-pericolosa"
      title={tr("Zona pericolosa")}
      tone="danger"
      icon={TriangleAlert}
      description={tr("Azioni che cancellano i tuoi dati. Per sicurezza ti chiediamo di confermare la tua identità.")}
    >
      <DangerActionDialog
        {...common}
        title={tr("Resetta tutti i dati")}
        summary="Cancella conti, transazioni, investimenti, categorie, regole, budget e storico. Riparti dall'inizio."
        triggerLabel="Resetta"
        dialogTitle="Resettare tutti i dati?"
        dialogDescription={
          <div className="flex flex-col gap-2">
            <p>{tr("Vengono cancellati per sempre conti, transazioni, investimenti, categorie, regole, budget e storico del patrimonio. I collegamenti con le banche vengono revocati.")}</p>
            <p>{tr("Restano il tuo account e i metodi di accesso. Ripartirai dalla scelta della valuta.")}</p>
          </div>
        }
        confirmLabel={tr("Resetta tutto")}
        canConfirm={resetWord === RESET_CONFIRMATION_WORD}
        pending={reset.isPending}
        error={reset.error}
        onClose={() => {
          setResetWord("");
          reset.reset();
        }}
        onConfirm={() =>
          reset.mutate(resetWord, {
            onSuccess: () => {
              track("account_reset");
              hardNavigate("/onboarding");
            },
          })
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="reset-confirmation" className="block leading-snug">{tr("Scrivi")}{" "}<strong className="font-semibold">{RESET_CONFIRMATION_WORD}</strong>{" "}{tr("per confermare")}</Label>
          <Input
            id="reset-confirmation"
            value={resetWord}
            onChange={(event) => setResetWord(event.target.value)}
            autoComplete="off"
            autoCapitalize="characters"
          />
        </div>
      </DangerActionDialog>

      <DangerActionDialog
        {...common}
        title={tr("Disattiva l'account")}
        summary={`L'account si blocca subito e viene eliminato dopo ${DEACTIVATION_GRACE_DAYS} giorni. Rientrando prima puoi riattivarlo.`}
        triggerLabel="Disattiva"
        dialogTitle="Disattivare l'account?"
        dialogDescription={
          <div className="flex flex-col gap-2">
            <p>{tr("Verrai disconnesso da tutti gli altri dispositivi e le sincronizzazioni con le banche si fermano. Tra")}{" "}
              {DEACTIVATION_GRACE_DAYS}{" "}{tr("giorni l'account e tutti i dati verranno eliminati definitivamente.")}</p>
            <p>{tr("Se cambi idea, accedi prima di quella data e scegli \"Riattiva account\". Ti mandiamo un'email con la data.")}</p>
          </div>
        }
        confirmLabel={tr("Disattiva account")}
        canConfirm
        pending={deactivate.isPending}
        error={deactivate.error}
        onClose={() => deactivate.reset()}
        onConfirm={() =>
          deactivate.mutate(undefined, {
            onSuccess: () => {
              track("account_deactivated");
              hardNavigate("/account-disattivato");
            },
          })
        }
      />

      <DangerActionDialog
        {...common}
        title={tr("Elimina l'account")}
        summary="Cancella subito e per sempre l'account e tutti i dati. Non si può annullare."
        triggerLabel="Elimina"
        dialogTitle="Eliminare l'account per sempre?"
        dialogDescription={
          <div className="flex flex-col gap-2">
            <p>{tr("L'account e tutti i dati vengono cancellati subito, senza possibilità di recupero. I collegamenti con le banche vengono revocati.")}</p>
            <p>{tr("Se vuoi tenere una copia, scarica prima i tuoi dati dalla sezione \"I tuoi dati\".")}</p>
          </div>
        }
        confirmLabel={tr("Elimina per sempre")}
        canConfirm={emailMatches}
        pending={remove.isPending}
        error={remove.error}
        onClose={() => {
          setDeleteEmail("");
          remove.reset();
        }}
        onConfirm={() =>
          remove.mutate(deleteEmail, {
            onSuccess: () => {
              track("account_deleted");
              hardNavigate(`/login?${ACCOUNT_DELETED_QUERY}`);
            },
          })
        }
      >
        <div className="flex flex-col gap-2">
          <Label htmlFor="delete-confirmation" className="block leading-snug">{tr("Scrivi la tua email per confermare")}</Label>
          <p className="text-xs break-all text-muted-foreground">{settings.email}</p>
          <Input
            id="delete-confirmation"
            type="email"
            value={deleteEmail}
            onChange={(event) => setDeleteEmail(event.target.value)}
            autoComplete="off"
          />
        </div>
      </DangerActionDialog>
    </SettingsSection>
  );
}
