import "server-only"
import { loadTables } from "./fixture"
import { buildDb, type Db } from "./db"

let db: Db | null = null

/** The indexed fixture, built once per server instance. */
export function getDb(): Db {
  if (!db) db = buildDb(loadTables())
  return db
}
