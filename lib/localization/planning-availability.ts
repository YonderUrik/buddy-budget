/** Country rollout switches: retained models are exposed only after product review. */
const PLANNING_AVAILABILITY = {
  DE: { tax: true, income: true, pension: false, retirement: false, simulations: false },
} as const;
type PlanningCapability = keyof (typeof PLANNING_AVAILABILITY)["DE"];
/** Visibility is independent of language and never changes persisted planning data. */
export function isPlanningAvailable(country: string, capability: PlanningCapability): boolean {
  const rollout = Object.hasOwn(PLANNING_AVAILABILITY, country)
    ? PLANNING_AVAILABILITY[country as keyof typeof PLANNING_AVAILABILITY] : null;
  return rollout?.[capability] ?? false;
}
