import "server-only";
import { loadUserPension } from "@/lib/pension/data";
import { buildPensionView } from "./pension";

/** Loads and computes `GET /api/pension/view` for a user. */
export async function loadPensionView(user: { id: string; currency?: string | null }, options: { today: string; fundId: string | null }) {
  const { funds } = await loadUserPension(user.id);
  return buildPensionView({ ...options, currency: user.currency ?? "EUR", funds });
}
