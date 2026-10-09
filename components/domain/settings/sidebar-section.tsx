"use client";

/**
 * Sezione «Barra laterale»: sceglie quali moduli mostrare sotto il menu (patrimonio, portafoglio, watchlist, scadenze,
 * obiettivo FIRE) e se su mobile usare la barra in basso. Le scelte valgono per questo dispositivo (localStorage), come
 * il tema; un modulo spento non carica nemmeno i suoi dati.
 */

import { Switch } from "@/components/ui/switch";
import { track } from "@/lib/analytics";
import { useBottomNav, useSidebarModule } from "@/lib/hooks/use-sidebar-preferences";
import { SIDEBAR_MODULES, type SidebarModuleId } from "@/lib/sidebar/modules";
import { SettingsRow, SettingsSection } from "./settings-section";

function ModuleRow({ id, label, hint }: { id: SidebarModuleId; label: string; hint: string }) {
  const [enabled, setEnabled] = useSidebarModule(id);
  return (
    <SettingsRow label={label} hint={hint} htmlFor={`sidebar-module-${id}`}>
      <Switch
        id={`sidebar-module-${id}`}
        checked={enabled}
        onCheckedChange={(checked) => {
          setEnabled(checked);
          track("sidebar_module_toggled", { module: id, enabled: checked });
        }}
        aria-label={label}
      />
    </SettingsRow>
  );
}

export function SidebarSection() {
  const [bottomNav, setBottomNav] = useBottomNav();
  return (
    <SettingsSection
      id="impostazioni-barra-laterale"
      title="Barra laterale"
      description="Scegli cosa vedere sotto il menu. Vale per questo dispositivo."
    >
      {SIDEBAR_MODULES.map((module) => (
        <ModuleRow key={module.id} id={module.id} label={module.label} hint={module.hint} />
      ))}
      <SettingsRow
        label="Barra in basso su mobile"
        hint="Le sezioni principali a portata di pollice, con «Altro» per il resto. Spenta, torna il menu a scomparsa."
        htmlFor="sidebar-bottom-nav"
      >
        <Switch
          id="sidebar-bottom-nav"
          checked={bottomNav}
          onCheckedChange={(checked) => {
            setBottomNav(checked);
            track("sidebar_module_toggled", { module: "barra_in_basso", enabled: checked });
          }}
          aria-label="Barra in basso su mobile"
        />
      </SettingsRow>
    </SettingsSection>
  );
}
