import { query } from "@solidjs/router"

// Vite gives the file a hashed name under /assets/, cached for a year, so a
// rebuild can never serve stale facts.
import factsUrl from "@/data/suburb-facts.json?url"
import { readJson } from "@/lib/json"
import type { SuburbFactsFile } from "@/types/suburb-facts"

export const getSuburbFacts = query(async () => {
  const res = await fetch(factsUrl)
  if (!res.ok) {
    throw new Error(`Suburb facts failed to load (${res.status})`)
  }
  return await readJson<SuburbFactsFile>(res)
}, "suburb-facts")
