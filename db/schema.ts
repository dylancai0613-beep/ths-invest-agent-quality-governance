import { sql } from "drizzle-orm";
import { text } from "drizzle-orm/sqlite-core";
import { sqliteTable } from "drizzle-orm/sqlite-core";

/** Session-scoped application snapshots. One row per browser session; no runtime DDL. */
export const qualitySessions = sqliteTable("quality_sessions", {
  sessionId: text("session_id").primaryKey(),
  stateJson: text("state_json").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
