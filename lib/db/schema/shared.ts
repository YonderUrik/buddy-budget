import { pgEnum } from "drizzle-orm/pg-core";

export const dataSourceEnum = pgEnum("data_source", ["manuale", "auto"]);
