// Helpers for MediaWiki batch queries, which rename the titles they're given.

import { z } from "zod/mini"

const mapping = z.array(z.object({ from: z.string(), to: z.string() }))

export const titleMappings = z.object({
  normalized: z.optional(mapping),
  redirects: z.optional(mapping),
})

// Follows a title through normalisation ("Foo_bar" to "Foo bar") and any
// redirect, to the title the API reports its page under.
export function resolveTitles(
  title: string,
  mappings: z.infer<typeof titleMappings> | undefined,
): string {
  const normalized =
    mappings?.normalized?.find((m) => m.from === title)?.to ?? title
  return (
    mappings?.redirects?.find((m) => m.from === normalized)?.to ?? normalized
  )
}

export function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
