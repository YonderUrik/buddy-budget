/**
 * components/domain/search — barrel: «Cerca», the app-wide search in the Spotlight style, and its entry points. The
 * panel itself is not exported: the provider loads it on its own (`next/dynamic`), so it stays out of every page's bundle.
 */
export { SearchProvider, useAppSearch, SEARCH_PARAM, prefillFor } from "./search-provider";
export type { SearchApi } from "./search-provider";
export { SearchField } from "./search-field";
export type { SpotlightProps } from "./spotlight";
