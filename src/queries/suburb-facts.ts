import { queryOptions } from "@tanstack/react-query"
import { z } from "zod/mini"

// Vite gives the file a hashed name under /assets/, cached for a year, so a
// rebuild can never serve stale facts.
import factsUrl from "@/data/suburb-facts.json?url"
import type { SuburbFactsFile } from "@/types/suburb-facts"

const photoSchema = z.object({
  url: z.string(),
  width: z.number(),
  height: z.number(),
  color: z.string(),
  artist: z.string(),
  licence: z.string(),
  licenceUrl: z.string(),
  sourceUrl: z.string(),
})

export const suburbFactsSchema: z.ZodMiniType<SuburbFactsFile> = z.record(
  z.string(),
  z.object({
    population: z.nullable(z.number()),
    postcode: z.nullable(z.string()),
    photo: z.nullable(photoSchema),
  }),
)

export const suburbFactsQuery = queryOptions({
  queryKey: ["suburb-facts"],
  queryFn: async () => {
    const res = await fetch(factsUrl)
    if (!res.ok) {
      throw new Error(`Suburb facts failed to load (${res.status})`)
    }
    const json: unknown = await res.json()
    return suburbFactsSchema.parse(json)
  },
  staleTime: Infinity,
})
