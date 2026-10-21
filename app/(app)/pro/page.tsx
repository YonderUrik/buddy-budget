import { PlansScreen, parseProNudgePlace } from "@/components/domain/billing";
import { parseProArea } from "@/lib/billing";

/** Plans page: Free and Pro, the 14-day trial, the subscription status and access codes (`?da=` = the locked area or the invitation). */
export default async function ProPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const value = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : null);
  const from = parseProArea(value("da")) ?? parseProNudgePlace(value("da"));
  const checkout = value("checkout") === "success" ? "success" : value("checkout") === "cancel" ? "cancel" : null;
  return <PlansScreen from={from} checkout={checkout} />;
}
