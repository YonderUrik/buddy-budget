"use client";
import { useLocalization } from "@/lib/localization/provider";

/**
 * Sezione «Barra laterale»: sceglie quali moduli mostrare sotto il menu (patrimonio, portafoglio, watchlist, scadenze,
 * obiettivo FIRE) e se su mobile usare la barra in basso. Le scelte valgono per questo dispositivo (localStorage), come
 * il tema; un modulo spento non carica nemmeno i suoi dati.
 */

import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { useBottomNav, useSidebarModule } from "@/lib/hooks/use-sidebar-preferences";
import { SIDEBAR_MODULES, type SidebarModuleId } from "@/lib/sidebar/modules";
import { PanelLeft } from "lucide-react";
import { SidebarPreview } from "./settings-preview";
import { SettingsRow, SettingsSection } from "./settings-section";

function ModuleRow({ id, label, hint }: { id: SidebarModuleId; label: string; hint: string }) {
  const { t: tr } = useLocalization();
  const [enabled, setEnabled] = useSidebarModule(id);
  return (
    <SettingsRow label={tr(label)} hint={tr(hint)} htmlFor={`sidebar-module-${id}`}>
      <Switch
        id={`sidebar-module-${id}`}
        checked={enabled}
        onCheckedChange={(checked) => {
          setEnabled(checked);
          track("sidebar_module_toggled", { module: id, enabled: checked });
        }}
        aria-label={tr(label)}
      />
    </SettingsRow>
  );
}

export function SidebarSection() {
  const { t: tr, features } = useLocalization();
  const [bottomNav, setBottomNav] = useBottomNav();
  return (
    <SettingsSection
      id="impostazioni-barra-laterale"
      title={tr("Barra laterale")}
      icon={PanelLeft}
      preview={<SidebarPreview />}
      description={tr("Scegli cosa vedere sotto il menu. Vale per questo dispositivo.")}
    >
      {SIDEBAR_MODULES.filter(module => features.retirement || module.id !== "fire").map((module) => (
        <ModuleRow key={module.id} id={module.id} label={tr(module.label)} hint={tr(module.hint)} />
      ))}
      <SettingsRow
        label={tr("Barra in basso su mobile")}
        hint={tr("Le sezioni principali in basso, con «Altro» per il resto. Spenta, torna il menu a scomparsa.")}
        htmlFor="sidebar-bottom-nav"
      >
        <Switch
          id="sidebar-bottom-nav"
          checked={bottomNav}
          onCheckedChange={(checked) => {
            setBottomNav(checked);
            track("sidebar_module_toggled", { module: "barra_in_basso", enabled: checked });
          }}
          aria-label={tr("Barra in basso su mobile")}
        />
      </SettingsRow>
    </SettingsSection>
  );
}
