// Helpers for MediaWiki batch queries, which rename the titles they're given.

import { array, object, optional, string, type InferOutput } from "valibot"

const mapping = array(object({ from: string(), to: string() }))

export const titleMappings = object({
  normalized: optional(mapping),
  redirects: optional(mapping),
})

// Follows a title through normalisation ("Foo_bar" to "Foo bar") and any
// redirect, to the title the API reports its page under.
export function resolveTitles(
  title: string,
  mappings: InferOutput<typeof titleMappings> | undefined,
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
