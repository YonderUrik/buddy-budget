import type { NavLock } from "@/components/layout";
import { track } from "@/lib/analytics";
import { PRO_AREAS, PRO_PAGE_PATH } from "@/lib/billing";

/**
 * Menu locks of the Free plan: every Pro section stays in the menu, dimmed with «Pro», and opens the plans page
 * for that section; each tap is counted (which sections make people consider Pro).
 */
export function planNavLocks(): Record<string, NavLock> {
  return Object.fromEntries(
    PRO_AREAS.map((area) => [
      area.path,
      { href: `${PRO_PAGE_PATH}?da=${area.id}`, badge: "Pro", hint: "Fa parte di Pro", onOpen: () => track("pro_lock_opened", { area: area.id }) },
    ]),
  );
}
