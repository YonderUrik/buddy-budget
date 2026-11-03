/**
 * Money flow of a period, as a Sankey diagram needs it: income sources flow into the period's money, which splits into
 * spending groups (Dovute, Volute, Te futuro, Saltuarie, uncategorised) plus what was set aside, and every group into
 * its categories. Pure: the same groups and sources the Analisi tab already computes.
 */

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
  categories: readonly FlowCategory[];
}

export interface MoneyFlowNode {
  id: string;
  label: string;
  value: number;
  color: string;
  /** Column (or row) of the diagram, from 0. */
  level: number;
  /** Group key the node belongs to (groups and their categories); `saved`, `income`, `source` otherwise. */
  kind: "source" | "income" | "group" | "saved" | "category";
  groupKey?: string;
  /** Categories folded into an «Altre» node. */
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

export interface MoneyFlowOptions {
  /** Categories shown per group before the rest is folded into «Altre». */
  categoriesPerGroup?: number;
  /** Keep the sources column (otherwise sources are summed into the income node). */
  withSources?: boolean;
  /** Keep the categories column. */
  withCategories?: boolean;
  savedLabel?: string;
  fromSavingsLabel?: string;
  incomeLabel?: string;
  otherLabel?: (group: string) => string;
  /** Categories below this share of the income are folded into «Altre», so no band is too thin to label. */
  minShare?: number;
  /** Groups drawn without categories (e.g. uncategorised, whose only category is itself). */
  leafless?: readonly string[];
}

export const SAVED_COLOR = "var(--primary)";
export const INCOME_COLOR = "var(--pos)";
export const FROM_SAVINGS_COLOR = "var(--neg)";

/** Builds the nodes and links of the flow; groups and categories are kept in the order given (largest first). */
export function buildMoneyFlow(sources: readonly FlowSource[], groups: readonly FlowGroup[], options: MoneyFlowOptions = {}): MoneyFlow {
  const {
    categoriesPerGroup = 4,
    withSources = true,
    withCategories = true,
    savedLabel = "Messo da parte",
    fromSavingsLabel = "Presi dai risparmi",
    incomeLabel = "Entrate",
    otherLabel = (group) => `Altre ${group.toLowerCase()}`,
    minShare = 0.03,
    leafless = ["daCategorizzare"],
  } = options;
  const income = sources.reduce((sum, s) => sum + s.amount, 0);
  const spent = groups.reduce((sum, g) => sum + g.amount, 0);
  const saved = income - spent;
  const nodes: MoneyFlowNode[] = [];
  const links: MoneyFlowLink[] = [];
  const base = withSources ? 1 : 0;

  if (withSources) {
    for (const s of sources) {
      nodes.push({ id: `source:${s.id}`, label: s.name, value: s.amount, color: INCOME_COLOR, level: 0, kind: "source" });
      links.push({ source: `source:${s.id}`, target: "income", value: s.amount, color: INCOME_COLOR });
    }
    if (saved < 0) {
      nodes.push({ id: "source:savings", label: fromSavingsLabel, value: -saved, color: FROM_SAVINGS_COLOR, level: 0, kind: "source" });
      links.push({ source: "source:savings", target: "income", value: -saved, color: FROM_SAVINGS_COLOR });
    }
  }
  nodes.push({ id: "income", label: incomeLabel, value: Math.max(income, spent), color: INCOME_COLOR, level: base, kind: "income" });

  for (const g of groups) {
    nodes.push({ id: `group:${g.key}`, label: g.label, value: g.amount, color: g.color, level: base + 1, kind: "group", groupKey: g.key });
    links.push({ source: "income", target: `group:${g.key}`, value: g.amount, color: g.color });
  }
  if (saved > 0) {
    nodes.push({ id: "saved", label: savedLabel, value: saved, color: SAVED_COLOR, level: base + 1, kind: "saved" });
    links.push({ source: "income", target: "saved", value: saved, color: SAVED_COLOR });
  }

  if (withCategories) {
    const floor = Math.max(income, spent) * minShare;
    for (const g of groups) {
      if (leafless.includes(g.key)) {
        // Carried unchanged to the last column, named only there.
        const node = nodes.find((n) => n.id === `group:${g.key}`);
        if (node) node.hideLabel = true;
        nodes.push({ id: `category:pass:${g.key}`, label: g.label, value: g.amount, color: g.color, level: base + 2, kind: "category", groupKey: g.key });
        links.push({ source: `group:${g.key}`, target: `category:pass:${g.key}`, value: g.amount, color: g.color });
        continue;
      }
      const big = g.categories.filter((c) => c.amount >= floor);
      let shown = big.slice(0, categoriesPerGroup);
      let rest = g.categories.slice(shown.length);
      // A single leftover keeps its own name instead of becoming «Altre».
      if (rest.length === 1) {
        shown = g.categories.slice(0, shown.length + 1);
        rest = [];
      }
      for (const c of shown) {
        nodes.push({ id: `category:${c.id}`, label: c.name, value: c.amount, color: g.color, level: base + 2, kind: "category", groupKey: g.key });
        links.push({ source: `group:${g.key}`, target: `category:${c.id}`, value: c.amount, color: g.color });
      }
      if (rest.length > 0) {
        const value = rest.reduce((sum, c) => sum + c.amount, 0);
        nodes.push({ id: `category:other:${g.key}`, label: otherLabel(g.label), value, color: g.color, level: base + 2, kind: "category", groupKey: g.key, folded: rest.length });
        links.push({ source: `group:${g.key}`, target: `category:other:${g.key}`, value, color: g.color });
      }
    }
  }
  return { income, spent, saved, nodes, links };
}

/** Flow of one group into all its categories (the second step of the step-by-step view). */
export function buildGroupFlow(group: FlowGroup): MoneyFlow {
  const nodes: MoneyFlowNode[] = [{ id: `group:${group.key}`, label: group.label, value: group.amount, color: group.color, level: 0, kind: "group", groupKey: group.key }];
  const links: MoneyFlowLink[] = [];
  for (const c of group.categories) {
    nodes.push({ id: `category:${c.id}`, label: c.name, value: c.amount, color: group.color, level: 1, kind: "category", groupKey: group.key });
    links.push({ source: `group:${group.key}`, target: `category:${c.id}`, value: c.amount, color: group.color });
  }
  return { income: group.amount, spent: group.amount, saved: 0, nodes, links };
}
