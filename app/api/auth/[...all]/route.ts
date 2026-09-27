import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { withRoute } from "@/lib/observability";

const handlers = toNextJsHandler(auth);

// Un solo nome di route per tutte le sotto-route di better-auth: il path reale non va nelle etichette.
export const GET = withRoute("auth", handlers.GET);
export const POST = withRoute("auth", handlers.POST);
