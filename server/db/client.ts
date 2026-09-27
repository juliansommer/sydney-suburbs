import { neon } from "@neondatabase/serverless"
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http"

import { getEnv } from "../env.js"
import * as schema from "./schema.js"

export type Db = NeonHttpDatabase<typeof schema>

let db: Db | undefined

// Neon over HTTP: each query is one fetch, with no connection to hold open
// between invocations.
export function getDb(): Db {
  db ??= drizzle({ client: neon(getEnv().DATABASE_URL), schema })
  return db
}
