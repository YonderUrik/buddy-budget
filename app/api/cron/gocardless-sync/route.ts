/** Vecchio indirizzo del cron di sync, tenuto finché il CronJob nel repo infra non punta a `/api/cron/bank-sync`. */
export { GET } from "@/app/api/cron/bank-sync/route";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
