"use client";

/**
 * Icona di una fonte di un obiettivo, come altrove nell'app: l'avatar scelto per il conto (Liquidità) o l'icona del
 * titolo con il suo logo (Investimenti). Senza dati per disegnarla resta l'icona del gruppo. Decorativa.
 */

import { LandmarkIcon, TrendingUpIcon } from "lucide-react";
import { AccountAvatar } from "@/components/domain/accounts";
import { InstrumentIcon } from "@/components/domain/investments/light";
import type { FreeSource } from "@/lib/goals/view";
import { GoalIcon } from "./goal-icon";

export interface GoalSourceIconProps {
  source: Pick<FreeSource, "kind" | "name" | "accountColor" | "accountIcon" | "instrumentType"> & { refId: string };
  /** `sm` (32 px) negli elenchi, `xs` (20 px) nelle etichette. */
  size?: "xs" | "sm";
  /** Chiamata quando compare un logo remoto (serve a citare Logo.dev). */
  onRemoteLogo?: () => void;
}

const AVATAR = { xs: { className: "size-5", icon: 11 }, sm: { className: "size-8", icon: 15 } } as const;

export function GoalSourceIcon({ source, size = "sm", onRemoteLogo }: GoalSourceIconProps) {
  if (source.kind === "account") {
    if (source.accountColor && source.accountIcon) {
      return <AccountAvatar color={source.accountColor} icon={source.accountIcon} className={AVATAR[size].className} size={AVATAR[size].icon} />;
    }
    return size === "sm" ? <GoalIcon icon={LandmarkIcon} color="var(--swatch-teal)" size="sm" /> : null;
  }
  if (source.instrumentType) {
    return <InstrumentIcon type={source.instrumentType} name={source.name} instrumentId={source.refId} size={size === "sm" ? "sm" : "xs"} onRemoteLogo={onRemoteLogo} />;
  }
  return size === "sm" ? <GoalIcon icon={TrendingUpIcon} color="var(--swatch-blue)" size="sm" /> : null;
}
