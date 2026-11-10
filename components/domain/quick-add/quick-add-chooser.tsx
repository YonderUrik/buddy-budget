"use client";

/**
 * Chooser of «Aggiungi»: the things added often come first and bigger, the ones added once or a few times sit below,
 * smaller. On the phone they are tiles (two big pairs, then a row of small ones); from the tablet up a list (name and one
 * line for the frequent ones, one compact line with the section for the others). Both are drawn and CSS shows one, so the
 * layout follows the screen without waiting for JavaScript.
 */

import {
  CreditCardIcon,
  FileSpreadsheetIcon,
  LandmarkIcon,
  ReceiptTextIcon,
  RepeatIcon,
  TargetIcon,
  TrendingUpIcon,
  UmbrellaIcon,
  type LucideIcon,
} from "lucide-react";
import { useLocalization } from "@/lib/localization/provider";
import { quickAddSectionTitle, type QuickAddActionId, type QuickAddMenu } from "@/lib/quick-add/actions";
import { cn } from "@/lib/utils";

/** Icon of each action. */
export const QUICK_ADD_ICONS: Record<QuickAddActionId, LucideIcon> = {
  movimento: ReceiptTextIcon,
  operazione: TrendingUpIcon,
  file: FileSpreadsheetIcon,
  conto: LandmarkIcon,
  abbonamento: RepeatIcon,
  debito: CreditCardIcon,
  pensione: UmbrellaIcon,
  obiettivo: TargetIcon,
};

/** Title above the things added once or a few times. */
const OCCASIONAL_TITLE = "Ogni tanto";

export interface QuickAddChooserProps {
  menu: QuickAddMenu;
  onSelect: (id: QuickAddActionId) => void;
}

const FOCUS = "outline-none focus-visible:ring-2 focus-visible:ring-ring";
const GROUP_TITLE = "text-sm font-medium text-text-3";
/** Yellow disc of a frequent thing: the brand colour of the main actions. */
const FREQUENT_ICON = "flex size-10 shrink-0 items-center justify-center rounded-full bg-sun text-on-sun";

/** Phone: two big pairs (typed, then from a file), then three small tiles per row. */
function Tiles({ menu, onSelect }: QuickAddChooserProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="flex flex-col gap-4 md:hidden">
      <ul className="grid grid-cols-2 gap-2" role="list">
        {menu.frequent.map((action) => {
          const Icon = QUICK_ADD_ICONS[action.id];
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onSelect(action.id)}
                className={cn("flex h-full min-h-28 w-full cursor-pointer flex-col items-start gap-3 rounded-2xl bg-muted/70 p-3.5 text-left transition-colors active:bg-muted dark:bg-background/70", FOCUS)}
              >
                <span className={FREQUENT_ICON}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[15px] font-semibold leading-tight">{tr(action.title)}</span>
                  <span className="text-xs leading-snug text-text-2">{tr(action.description)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <section className="flex flex-col gap-1.5" aria-label={tr(OCCASIONAL_TITLE)}>
        <h3 className={cn(GROUP_TITLE, "px-1")}>{tr(OCCASIONAL_TITLE)}</h3>
        <ul className="grid grid-cols-3 gap-2" role="list">
          {menu.occasional.map((action) => {
            const Icon = QUICK_ADD_ICONS[action.id];
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => onSelect(action.id)}
                  aria-label={tr(action.title)}
                  className={cn("flex h-full min-h-19 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-2xl bg-muted/40 px-1.5 py-2.5 text-center transition-colors active:bg-muted dark:bg-background/40", FOCUS)}
                >
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <span className="text-[13px] font-medium leading-tight text-balance">{tr(action.short ?? action.title)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** Tablet and desktop: the frequent things with one line each, then the others on one compact line with their section. */
function List({ menu, onSelect }: QuickAddChooserProps) {
  const { t: tr } = useLocalization();
  return (
    <div className="hidden flex-col gap-3 md:flex">
      <ul className="flex flex-col" role="list">
        {menu.frequent.map((action) => {
          const Icon = QUICK_ADD_ICONS[action.id];
          return (
            <li key={action.id}>
              <button
                type="button"
                onClick={() => onSelect(action.id)}
                className={cn("flex min-h-14 w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted", FOCUS)}
              >
                <span className={FREQUENT_ICON}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{tr(action.title)}</span>
                  <span className="block text-xs leading-snug text-text-2">{tr(action.description)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <section className="flex flex-col" aria-label={tr(OCCASIONAL_TITLE)}>
        <h3 className={cn(GROUP_TITLE, "px-2 pb-1")}>{tr(OCCASIONAL_TITLE)}</h3>
        <ul className="flex flex-col" role="list">
          {menu.occasional.map((action) => {
            const Icon = QUICK_ADD_ICONS[action.id];
            return (
              <li key={action.id}>
                <button
                  type="button"
                  onClick={() => onSelect(action.id)}
                  className={cn("flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-xl px-2 text-left transition-colors hover:bg-muted focus-visible:bg-muted", FOCUS)}
                >
                  <span className="flex size-10 shrink-0 items-center justify-center">
                    <Icon className="size-[18px] text-primary" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{tr(action.title)}</span>
                  <span className="shrink-0 text-xs text-text-3">{tr(quickAddSectionTitle(action.section))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}

/** The chooser; it only reports the choice, the caller opens the form. */
export function QuickAddChooser({ menu, onSelect }: QuickAddChooserProps) {
  return (
    <>
      <Tiles menu={menu} onSelect={onSelect} />
      <List menu={menu} onSelect={onSelect} />
    </>
  );
}
