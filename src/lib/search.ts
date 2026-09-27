export const SEARCH_LIMIT = 8

export interface SearchEntry<T> {
  item: T
  // Lowercase, unaccented, words split on spaces and hyphens.
  words: string
  // The same without spaces, so "stives" and "kuringgai" still match.
  compact: string
}

// Folds case, accents and punctuation. Apostrophes and full stops vanish
// ("O'Hara" is "ohara"), other punctuation splits words.
export function normalise(text: string) {
  return text
    .normalize("NFD")
    .replaceAll(/\p{M}/gu, "")
    .toLowerCase()
    .replaceAll(/['’.]/g, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
}

// Normalises every name once, sorted so ties within a rank are alphabetical.
export function buildIndex<T>(
  items: readonly T[],
  name: (item: T) => string,
): SearchEntry<T>[] {
  return items
    .map((item) => {
      const words = normalise(name(item))
      return { item, words, compact: words.replaceAll(" ", "") }
    })
    .toSorted((a, b) => a.words.localeCompare(b.words))
}

// Ranks name prefix, then word prefix, then anywhere in the name.
export function search<T>(
  index: readonly SearchEntry<T>[],
  query: string,
  limit = SEARCH_LIMIT,
): T[] {
  const words = normalise(query)
  if (!words) {
    return []
  }
  const compact = words.replaceAll(" ", "")
  const ranks: T[][] = [[], [], []]
  for (const entry of index) {
    if (entry.words.startsWith(words)) {
      ranks[0]?.push(entry.item)
    } else if (entry.words.includes(` ${words}`)) {
      ranks[1]?.push(entry.item)
    } else if (entry.compact.includes(compact)) {
      ranks[2]?.push(entry.item)
    }
  }
  return ranks.flat().slice(0, limit)
}
