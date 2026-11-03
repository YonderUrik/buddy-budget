/**
 * Money flow of a period, as a Sankey diagram needs it: income sources flow into the period's income, which splits
 * into spending groups (Dovute, Volute, Te futuro, Saltuarie, uncategorised) plus what was set aside, and every group
 * into its categories. When spending exceeds income, the gap enters as «Presi dai risparmi». Pure: it reads the same
 * groups and sources the Analisi tab already computes.
 */

import { UNCATEGORIZED_GROUP_KEY } from "@/lib/categories/groups";

export interface FlowSource {
  id: string;
  name: string;
  amount: number;
}

export interface FlowCategory {
  id: string;
  name: string;
  amount: number;
}

export interface FlowGroup {
  key: string;
  label: string;
  /** CSS colour token of the group. */
  color: string;
  amount: number;
  /** Largest first. */
  categories: readonly FlowCategory[];
}

export interface MoneyFlowNode {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Column of the diagram, from 0. */
  level: number;
  kind: "source" | "savings" | "income" | "group" | "saved" | "category";
  /** Group the node belongs to (groups and their categories). */
  groupKey?: string;
  /** Real category behind a category node (absent on «Altre» and carried-over nodes). */
  categoryId?: string;
  /** Number of categories folded into an «Altre» node. */
  folded?: number;
  /** The node's name is written elsewhere (a group carried unchanged to the categories column). */
  hideLabel?: boolean;
}

export interface MoneyFlowLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

export interface MoneyFlow {
  income: number;
  spent: number;
  /** Income minus spending: positive = set aside, negative = taken from savings. */
  saved: number;
  nodes: MoneyFlowNode[];
  links: MoneyFlowLink[];
}

export interface MoneyFlowLabels {
  income: string;
  saved: string;
  fromSavings: string;
  /** Name of the node that folds a group's smallest categories. */
  other: (groupLabel: string) => string;
}

export interface MoneyFlowOptions {
  /** Sources column before the income node (otherwise income and savings start the flow). */
  withSources?: boolean;
  /** Categories column after the groups. */
  withCategories?: boolean;
  /** Categories shown per group before the rest is folded into «Altre». */
  categoriesPerGroup?: number;
  /** Categories below this share of the money in are folded into «Altre», so no band is too thin to name. */
  minShare?: number;
  /** Groups carried to the categories column as they are (uncategorised: its only category is itself). */
  leafless?: readonly string[];
  labels?: Partial<MoneyFlowLabels>;
}

export const SAVED_COLOR = "var(--primary)";
export const INCOME_COLOR = "var(--pos)";
export const FROM_SAVINGS_COLOR = "var(--neg)";
export const DEFAULT_CATEGORIES_PER_GROUP = 4;
export const DEFAULT_MIN_SHARE = 0.03;

const DEFAULT_LABELS: MoneyFlowLabels = {
  income: "Entrate",
  saved: "Messo da parte",
  fromSavings: "Presi dai risparmi",
  other: (group) => `Altre ${group.toLowerCase()}`,
};

/** Builds the nodes and links of the flow; groups and categories keep the order given. */
export function buildMoneyFlow(sources: readonly FlowSource[], groups: readonly FlowGroup[], options: MoneyFlowOptions = {}): MoneyFlow {
  const {
    withSources = true,
    withCategories = true,
    categoriesPerGroup = DEFAULT_CATEGORIES_PER_GROUP,
    minShare = DEFAULT_MIN_SHARE,
    leafless = [UNCATEGORIZED_GROUP_KEY],
  } = options;
  const labels = { ...DEFAULT_LABELS, ...options.labels };
  const income = sources.reduce((sum, s) => sum + s.amount, 0);
  const spent = groups.reduce((sum, g) => sum + g.amount, 0);
  const saved = income - spent;
  const moneyIn = Math.max(income, spent);
  const nodes: MoneyFlowNode[] = [];
  const links: MoneyFlowLink[] = [];
  const groupLevel = withSources ? 2 : 1;
  const savingsNode = (level: number): MoneyFlowNode => ({ id: "savings", label: labels.fromSavings, value: -saved, color: FROM_SAVINGS_COLOR, level, kind: "savings" });

  if (withSources) {
    for (const s of sources) {
      nodes.push({ id: `source:${s.id}`, label: s.name, value: s.amount, color: INCOME_COLOR, level: 0, kind: "source" });
      links.push({ source: `source:${s.id}`, target: "income", value: s.amount, color: INCOME_COLOR });
    }
    if (saved < 0) {
      nodes.push(savingsNode(0));
      links.push({ source: "savings", target: "income", value: -saved, color: FROM_SAVINGS_COLOR });
    }
    nodes.push({ id: "income", label: labels.income, value: moneyIn, color: INCOME_COLOR, level: 1, kind: "income" });
    for (const g of groups) links.push({ source: "income", target: `group:${g.key}`, value: g.amount, color: g.color });
  } else {
    // Without sources the income node holds only what came in; a deficit is a second starting node, and each group
    // takes from both in proportion.
    if (income > 0) nodes.push({ id: "income", label: labels.income, value: income, color: INCOME_COLOR, level: 0, kind: "income" });
    if (saved < 0) nodes.push(savingsNode(0));
    for (const g of groups) {
      if (saved >= 0) links.push({ source: "income", target: `group:${g.key}`, value: g.amount, color: g.color });
      else {
        if (income > 0) links.push({ source: "income", target: `group:${g.key}`, value: (g.amount * income) / spent, color: g.color });
        links.push({ source: "savings", target: `group:${g.key}`, value: (g.amount * -saved) / spent, color: FROM_SAVINGS_COLOR });
      }
    }
  }

  for (const g of groups) nodes.push({ id: `group:${g.key}`, label: g.label, value: g.amount, color: g.color, level: groupLevel, kind: "group", groupKey: g.key });
  if (saved > 0) {
    nodes.push({ id: "saved", label: labels.saved, value: saved, color: SAVED_COLOR, level: groupLevel, kind: "saved" });
    links.push({ source: "income", target: "saved", value: saved, color: SAVED_COLOR });
  }

  if (withCategories) {
    const floor = moneyIn * minShare;
    const level = groupLevel + 1;
    for (const g of groups) {
      if (leafless.includes(g.key)) {
        const node = nodes.find((n) => n.id === `group:${g.key}`);
        if (node) node.hideLabel = true;
        nodes.push({ id: `category:pass:${g.key}`, label: g.label, value: g.amount, color: g.color, level, kind: "category", groupKey: g.key });
        links.push({ source: `group:${g.key}`, target: `category:pass:${g.key}`, value: g.amount, color: g.color });
        continue;
      }
      let shown = g.categories.filter((c) => c.amount >= floor).slice(0, categoriesPerGroup);
      let rest = g.categories.slice(shown.length);
      // A single leftover keeps its own name instead of becoming «Altre».
      if (rest.length === 1) {
        shown = g.categories.slice(0, shown.length + 1);
        rest = [];
      }
      for (const c of shown) {
        nodes.push({ id: `category:${c.id}`, label: c.name, value: c.amount, color: g.color, level, kind: "category", groupKey: g.key, categoryId: c.id });
        links.push({ source: `group:${g.key}`, target: `category:${c.id}`, value: c.amount, color: g.color });
      }
      if (rest.length > 0) {
        const value = rest.reduce((sum, c) => sum + c.amount, 0);
        nodes.push({ id: `category:other:${g.key}`, label: labels.other(g.label), value, color: g.color, level, kind: "category", groupKey: g.key, folded: rest.length });
        links.push({ source: `group:${g.key}`, target: `category:other:${g.key}`, value, color: g.color });
      }
    }
  }
  return { income, spent, saved, nodes, links };
}

/** Flow of one group into all its categories (the second step on the phone). */
export function buildGroupFlow(group: FlowGroup): MoneyFlow {
  const nodes: MoneyFlowNode[] = [{ id: `group:${group.key}`, label: group.label, value: group.amount, color: group.color, level: 0, kind: "group", groupKey: group.key }];
  const links: MoneyFlowLink[] = [];
  for (const c of group.categories) {
    nodes.push({ id: `category:${c.id}`, label: c.name, value: c.amount, color: group.color, level: 1, kind: "category", groupKey: group.key, categoryId: c.id });
    links.push({ source: `group:${group.key}`, target: `category:${c.id}`, value: c.amount, color: group.color });
  }
  return { income: group.amount, spent: group.amount, saved: 0, nodes, links };
}
