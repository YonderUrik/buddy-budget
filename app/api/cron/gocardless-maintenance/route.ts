/** Vecchio indirizzo del cron di manutenzione, tenuto finché il CronJob nel repo infra non punta a `/api/cron/bank-maintenance`. */
export { GET } from "@/app/api/cron/bank-maintenance/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
