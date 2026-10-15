import { PROFILE } from "@/lib/localization";
import { FEATURES as ALL_FEATURES, FEATURE_AREAS } from "./catalog.generated";
import type { FeatureArea, FeatureStatus } from "./catalog.generated";
export { FEATURE_AREAS };
export type { FeatureArea, FeatureStatus };
const UNREVIEWED_DE = new Set(["pensione", "analitiche", "obiettivi-di-risparmio", "zainetto-fiscale", "simulatore-prima-di-vendere", "tasse-italiane"]);
export const FEATURES = ALL_FEATURES.filter(f => PROFILE.country === "IT" || (!UNREVIEWED_DE.has(f.id) && !/pensione|analitiche/.test(f.appPath ?? "")));
export function featuresByArea(area: FeatureArea) { return FEATURES.filter(f => f.area === area); }
export function featuresByStatus(status: FeatureStatus) { return FEATURES.filter(f => f.status === status); }
export function featureCounts() { return { total: FEATURES.length, available: FEATURES.filter(f => f.status !== "soon").length }; }
