"use client";

/**
 * Spese per gruppo (Dovute, Volute, Te futuro, Saltuarie): la ciambella ha al più cinque fette qualunque sia il numero di categorie,
 * e ogni gruppo si apre sulle sue categorie (le prime, poi "Mostra tutte"). Un clic su una categoria la passa a chi ascolta (es. per filtrare i movimenti).
 */

import * as React from "react";
import { ChevronDownIcon } from "lucide-react";
import { CategoryAvatar } from "@/components/domain/categories";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { CategoryColor, CategoryIcon } from "@/lib/validation/categories";
import { CategoryDonut } from "./category-donut";

export interface SpendCategory {
  id: string;
  name: string;
  color: string;
  icon: string;
  amount: number;
}

export interface SpendGroup {
  key: string;
  label: string;
  /** Token CSS del colore del gruppo. */
  color: string;
  amount: number;
  categories: readonly SpendCategory[];
}

export interface SpendByGroupProps {
  groups: readonly SpendGroup[];
  currency: string;
  /** Categorie mostrate per gruppo prima di "Mostra tutte". */
  visibleCategories?: number;
  onPickCategory?: (categoryId: string) => void;
}

const DEFAULT_VISIBLE = 5;

interface GroupBlockProps {
  group: SpendGroup;
  total: number;
  currency: string;
  visible: number;
  open: boolean;
  /** Gruppo in evidenza (passaggio sulla fetta o blocco). */
  highlighted: boolean;
  /** Gruppo bloccato con un clic: bordo di richiamo. */
  locked: boolean;
  onToggle: () => void;
  onHoverChange: (key: string | null) => void;
  onPickCategory?: (id: string) => void;
}

function GroupBlock({ group, total, currency, visible, open, highlighted, locked, onToggle, onHoverChange, onPickCategory }: GroupBlockProps) {
  const [all, setAll] = React.useState(false);
  const money = (n: number) => formatCurrency(n, currency, { maximumFractionDigits: 0 });
  const shown = all ? group.categories : group.categories.slice(0, visible);
  const panelId = `spend-group-${group.key}`;
  return (
    <li
      className={cn("rounded-2xl bg-foreground/[0.04] transition-colors", highlighted && "bg-foreground/[0.09]", locked && "ring-1 ring-ring")}
      onMouseEnter={() => onHoverChange(group.key)}
      onMouseLeave={() => onHoverChange(null)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
        className="flex min-h-14 w-full items-center gap-3.5 rounded-2xl px-4 py-3 text-left focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="size-3.5 shrink-0 rounded-full" style={{ backgroundColor: group.color }} aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{group.label}</span>
          <span className="block text-sm text-text-2">
            {Math.round((group.amount / (total || 1)) * 100)}% delle spese · {group.categories.length} {group.categories.length === 1 ? "categoria" : "categorie"}
          </span>
        </span>
        <span className="font-heading font-semibold tabular-nums">{money(group.amount)}</span>
        <ChevronDownIcon className={cn("size-5 shrink-0 text-text-2 transition-transform motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <ul id={panelId} className="flex flex-col gap-0.5 px-2 pb-2">
          {shown.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPickCategory?.(c.id)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left hover:bg-foreground/[0.06] focus-visible:outline-2 focus-visible:outline-ring"
              >
                <CategoryAvatar color={c.color as CategoryColor} icon={c.icon as CategoryIcon} size={15} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{c.name}</span>
                  <span className="mt-1 block h-1.5 rounded-full bg-foreground/[0.08]" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${Math.max((c.amount / (group.amount || 1)) * 100, 2)}%`, backgroundColor: group.color }} />
                  </span>
                </span>
                <span className="text-sm font-semibold tabular-nums">{money(c.amount)}</span>
              </button>
            </li>
          ))}
          {group.categories.length > visible && (
            <li>
              <button type="button" onClick={() => setAll((v) => !v)} className="min-h-11 w-full rounded-xl px-2 text-left text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-ring">
                {all ? "Mostra meno" : `Mostra tutte (${group.categories.length})`}
              </button>
            </li>
          )}
        </ul>
      )}
    </li>
  );
}

export function SpendByGroup({ groups, currency, visibleCategories = DEFAULT_VISIBLE, onPickCategory }: SpendByGroupProps) {
  const [hoveredKey, setHoveredKey] = React.useState<string | null>(null);
  const [lockedKey, setLockedKey] = React.useState<string | null>(null);
  const [openKeys, setOpenKeys] = React.useState<ReadonlySet<string>>(new Set());
  const total = groups.reduce((sum, g) => sum + g.amount, 0);
  const slices = groups.map((g) => ({ key: g.key, label: g.label, value: g.amount, color: g.color }));
  const focusKey = hoveredKey ?? lockedKey;
  const toggleOpen = (key: string, force?: boolean) =>
    setOpenKeys((current) => {
      const next = new Set(current);
      const shouldOpen = force ?? !next.has(key);
      if (shouldOpen) next.add(key);
      else next.delete(key);
      return next;
    });
  // Il clic su una fetta la blocca e ne apre il gruppo; un secondo clic sblocca.
  const selectSlice = (key: string) => {
    const unlocking = lockedKey === key;
    setLockedKey(unlocking ? null : key);
    toggleOpen(key, !unlocking);
  };
  return (
    <div className="flex flex-wrap items-center gap-8">
      <div className="self-start">
        <CategoryDonut slices={slices} currency={currency} centerLabel="di spese" focusKey={focusKey} onHoverChange={setHoveredKey} onSelect={selectSlice} />
      </div>
      <ul className="flex min-w-60 flex-1 flex-col gap-1.5">
        {groups.map((g) => (
          <GroupBlock
            key={g.key}
            group={g}
            total={total}
            currency={currency}
            visible={visibleCategories}
            open={openKeys.has(g.key)}
            highlighted={focusKey === g.key}
            locked={lockedKey === g.key}
            onToggle={() => toggleOpen(g.key)}
            onHoverChange={setHoveredKey}
            onPickCategory={onPickCategory}
          />
        ))}
      </ul>
    </div>
  );
}
