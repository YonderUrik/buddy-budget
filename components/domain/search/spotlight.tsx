"use client";

/**
 * «Cerca» in the Spotlight style of macOS and iOS 26. On a computer: a glass capsule floating over the page (not
 * dimmed), four round glass buttons beside it to narrow the search before typing, and the results growing out of the
 * capsule as you type. On the phone: the page blurred behind, the results in glass cards and the field at the bottom
 * above the keyboard, where the thumb is. Arrow keys move, Enter opens, Esc closes.
 */

import * as React from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircleIcon, PlusIcon, ReceiptTextIcon, SearchIcon, SettingsIcon, TrendingUpIcon, XIcon, type LucideIcon } from "lucide-react";
import type { CommandDraft } from "@/lib/commands";
import type { Instrument } from "@/lib/db/schema/investments";
import { authClient } from "@/lib/auth/client";
import { useLocalization } from "@/lib/localization/provider";
import { SPRING_BOUNCY, SPRING_SNAPPY } from "@/lib/motion/springs";
import type { SearchHit } from "@/lib/search/types";
import { cn } from "@/lib/utils";
import { SpotlightExamples } from "./spotlight-examples";
import { SpotlightResults } from "./spotlight-results";
import { SPOTLIGHT_CARD, SPOTLIGHT_COVER, SPOTLIGHT_GLASS } from "./spotlight-style";
import { SPOTLIGHT_FILTERS, useSpotlight, type SpotlightBlock, type SpotlightFilter, type SpotlightItem } from "./use-spotlight";

/** Width below which the phone layout is used (Tailwind `sm`). */
const PHONE_MAX_WIDTH = 639;
const FILTER_INFO: Record<SpotlightFilter, { icon: LucideIcon; label: string }> = {
  movimenti: { icon: ReceiptTextIcon, label: "Movimenti e conti" },
  investimenti: { icon: TrendingUpIcon, label: "Titoli" },
  impostazioni: { icon: SettingsIcon, label: "Pagine e impostazioni" },
  aggiungi: { icon: PlusIcon, label: "Aggiungi" },
};

function useIsPhone(): boolean {
  const [phone, setPhone] = React.useState(() => typeof window !== "undefined" && window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`).matches);
  React.useEffect(() => {
    const query = window.matchMedia(`(max-width: ${PHONE_MAX_WIDTH}px)`);
    const update = () => setPhone(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return phone;
}

/** Height the on-screen keyboard takes from the bottom of the window (0 without one), so the phone field sits on top of it. */
function useKeyboardInset(): number {
  const [inset, setInset] = React.useState(0);
  React.useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const update = () => setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

/** Height of `ref`'s content, followed as it changes (for the capsule that grows with the results). */
function useContentHeight(ref: React.RefObject<HTMLDivElement | null>): number {
  const [height, setHeight] = React.useState(0);
  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setHeight(node.offsetHeight));
    observer.observe(node);
    setHeight(node.offsetHeight);
    return () => observer.disconnect();
  }, [ref]);
  return height;
}

export interface SpotlightProps {
  initialText: string;
  idle: SpotlightBlock[];
  onClose: () => void;
  onPickHit: (hit: SearchHit, position: number, text: string) => void;
  onCommand: (draft: CommandDraft, instrument: Instrument | null) => void;
}

export function Spotlight({ initialText, idle, onClose, onPickHit, onCommand }: SpotlightProps) {
  const { t: tr } = useLocalization();
  const { data: session } = authClient.useSession();
  const currency = session?.user.currency ?? "EUR";
  const phone = useIsPhone();
  const keyboard = useKeyboardInset();
  const [text, setText] = React.useState(initialText);
  const [filter, setFilter] = React.useState<SpotlightFilter | null>(null);
  const [active, setActive] = React.useState(0);
  const listId = React.useId();
  const { blocks, items, waiting, query, moreMovements, askAi } = useSpotlight({ text, filter, idle: phone ? idle : [] });
  const contentRef = React.useRef<HTMLDivElement>(null);
  const contentHeight = useContentHeight(contentRef);
  const optionId = (index: number) => `${listId}-${index}`;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const tryExample = (sentence: string) => {
    setText(sentence);
    inputRef.current?.focus();
  };

  // A new query or filter starts again from the first row.
  const [lastKey, setLastKey] = React.useState(`${query}|${filter}`);
  if (lastKey !== `${query}|${filter}`) {
    setLastKey(`${query}|${filter}`);
    setActive(0);
  }
  React.useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView({ block: "nearest" });
  });
  React.useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(item: SpotlightItem, position: number) {
    if (item.type === "ai") {
      if (item.status === "idle" || item.status === "failed") askAi();
      return;
    }
    if (item.type === "command") onCommand(item.draft, item.instrument);
    else onPickHit(item.hit, position, text);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(items.length - 1, i + 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (event.key === "Enter" && items[active]) {
      event.preventDefault();
      pick(items[active], active);
    } else if (event.key === "Backspace" && text === "" && filter) {
      setFilter(null);
    } else if ((event.metaKey || event.ctrlKey) && /^[1-4]$/.test(event.key)) {
      event.preventDefault();
      const next = SPOTLIGHT_FILTERS[Number(event.key) - 1];
      setFilter((current) => (current === next ? null : next));
    }
  }

  const input = (
    <input
      ref={inputRef}
      autoFocus
      value={text}
      onChange={(event) => setText(event.target.value)}
      onKeyDown={onKeyDown}
      maxLength={160}
      placeholder={filter ? tr("Cerca in {0}", { 0: tr(FILTER_INFO[filter].label).toLocaleLowerCase() }) : tr(phone ? "Cerca o scrivi «12 € al bar»" : "Cerca o scrivi «speso 12 € al bar»")}
      role="combobox"
      aria-expanded={items.length > 0}
      aria-controls={listId}
      aria-activedescendant={items.length > 0 ? optionId(active) : undefined}
      aria-label={tr("Cerca in BuddyBudget")}
      enterKeyHint="search"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      className={cn("min-w-0 flex-1 bg-transparent outline-none placeholder:text-text-3", phone ? "text-[17px]" : "text-2xl font-light tracking-tight")}
    />
  );
  const spinner = waiting ? <LoaderCircleIcon className="size-4 shrink-0 animate-spin text-text-3" aria-hidden="true" /> : null;
  const results = (
    <div id={listId} role="listbox" aria-label={tr("Risultati")}>
      <SpotlightResults blocks={blocks} query={query} active={active} currency={currency} phone={phone} moreMovements={moreMovements} optionId={optionId} onPick={pick} onHover={setActive} />
    </div>
  );
  const empty = query !== "" && blocks.length === 0 && !waiting;

  if (phone) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" role="dialog" aria-modal="true" aria-label={tr("Cerca in BuddyBudget")}>
        <motion.div className={cn("absolute inset-0", SPOTLIGHT_COVER)} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} onClick={onClose} />
        <motion.div
          className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12, transition: { duration: 0.15 } }}
          transition={SPRING_SNAPPY}
        >
          {text === "" && !filter ? <SpotlightExamples phone onPick={tryExample} className="pt-2 pb-5" /> : null}
          {empty ? <p className="px-3 pt-6 text-center text-sm text-text-2">{tr("Niente con «{0}».", { 0: text.trim() })}</p> : results}
        </motion.div>
        <motion.div
          className="relative flex items-center gap-2 px-3 pt-2"
          style={{ paddingBottom: `calc(max(env(safe-area-inset-bottom), 0.75rem) + ${keyboard}px)` }}
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0, transition: { duration: 0.18 } }}
          transition={SPRING_BOUNCY}
        >
          <label className={cn("flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4", SPOTLIGHT_CARD)}>
            <SearchIcon className="size-5 shrink-0 text-text-2" aria-hidden="true" />
            {input}
            {spinner}
          </label>
          <button type="button" onClick={onClose} aria-label={tr("Chiudi")} className={cn("flex size-12 shrink-0 cursor-pointer items-center justify-center rounded-full", SPOTLIGHT_CARD)}>
            <XIcon className="size-5" aria-hidden="true" />
          </button>
        </motion.div>
      </div>
    );
  }

  const examples = text === "" && !filter;
  const open = blocks.length > 0 || empty || examples;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={tr("Cerca in BuddyBudget")}>
      {/* The page stays as it is behind (Spotlight does not dim it); a click outside the capsule closes. */}
      <div className="absolute inset-0" onPointerDown={onClose} />
      <div className="pointer-events-none relative mx-auto mt-[18vh] flex w-[min(760px,calc(100vw-2rem))] items-start gap-2.5">
        <motion.div
          className={cn("pointer-events-auto min-w-0 flex-1 overflow-hidden rounded-[30px]", SPOTLIGHT_GLASS)}
          initial={{ opacity: 0, scale: 0.94, y: -12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: -6, transition: { duration: 0.14 } }}
          transition={SPRING_BOUNCY}
        >
          <div className="flex h-16 items-center gap-3.5 px-5">
            <SearchIcon className="size-6 shrink-0 text-text-2" strokeWidth={2} aria-hidden="true" />
            {filter ? (
              <button type="button" onClick={() => setFilter(null)} className="flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-foreground/[0.07] pr-2 pl-3 text-sm font-medium">
                {tr(FILTER_INFO[filter].label)}
                <XIcon className="size-3.5 text-text-3" aria-label={tr("Togli il filtro")} />
              </button>
            ) : null}
            {input}
            {spinner}
          </div>
          <motion.div initial={false} animate={{ height: open ? contentHeight : 0 }} transition={SPRING_SNAPPY} className="overflow-hidden">
            <div ref={contentRef}>
              {open ? (
                <>
                  <div className="max-h-[min(58vh,560px)] overflow-y-auto overscroll-contain border-t border-glass-edge px-2 pt-3 pb-2">
                    {examples ? <SpotlightExamples onPick={tryExample} className="pb-2" /> : null}
                    {empty ? <p className="px-3 py-6 text-center text-sm text-text-2">{tr("Niente con «{0}». Prova con una parola sola, un importo come 45,90 o un ISIN.", { 0: text.trim() })}</p> : examples ? null : results}
                  </div>
                  <div className="flex h-10 items-center gap-2 border-t border-glass-edge px-5 text-xs text-text-3">
                    <Image src="/brand/logo-mark.svg" alt="" width={11} height={14} className="h-3.5 w-auto" aria-hidden="true" />
                    <span className="font-medium text-text-2">BuddyBudget</span>
                    <span className="ml-auto">{tr("↑↓ per scegliere · ⏎ per aprire · esc per chiudere")}</span>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
        <AnimatePresence>
          {text === "" ? (
            <motion.div className="pointer-events-auto flex gap-2" exit={{ opacity: 0, x: -10, transition: { duration: 0.12 } }}>
              {SPOTLIGHT_FILTERS.map((id, index) => {
                const { icon: Icon, label } = FILTER_INFO[id];
                const on = filter === id;
                return (
                  <motion.button
                    key={id}
                    type="button"
                    onClick={() => setFilter(on ? null : id)}
                    title={`${tr(label)} · ⌘${index + 1}`}
                    aria-label={tr(label)}
                    aria-pressed={on}
                    initial={{ opacity: 0, scale: 0.7, x: -16 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    transition={{ ...SPRING_BOUNCY, delay: 0.04 + index * 0.035 }}
                    className={cn("flex size-16 cursor-pointer items-center justify-center rounded-full transition-colors", on ? "bg-foreground text-background shadow-[0_12px_32px_-12px_var(--spotlight-shadow)]" : cn(SPOTLIGHT_GLASS, "text-text-2 hover:text-foreground"))}
                  >
                    <Icon className="size-[22px]" strokeWidth={1.75} aria-hidden="true" />
                  </motion.button>
                );
              })}
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}
