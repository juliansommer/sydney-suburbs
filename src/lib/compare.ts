import type { StatKey } from "@/lib/stats"
import type { SuburbFactsFile } from "@/types/suburb-facts"

// Each stat's values across every suburb that has one, lowest first.
type Ranking = Partial<Record<StatKey, number[]>>

const rankings = new WeakMap<SuburbFactsFile, Ranking>()

function sortedValues(facts: SuburbFactsFile, key: StatKey): number[] {
  const cached = rankings.get(facts) ?? {}
  rankings.set(facts, cached)

  const values =
    cached[key] ??
    Object.values(facts)
      .flatMap((f) => (f.stats[key] === null ? [] : [f.stats[key]]))
      .toSorted((a, b) => a - b)

  cached[key] = values

  return values
}

// How many values sit below `value`, found by halving the sorted list.
function countBelow(sorted: readonly number[], value: number): number {
  let low = 0
  let high = sorted.length

  while (low < high) {
    const mid = Math.floor((low + high) / 2)

    if ((sorted[mid] ?? 0) < value) {
      low = mid + 1
    } else {
      high = mid
    }
  }

  return low
}

// Where a value sits among every suburb's, from 0 (the lowest) to 1 (the
// highest), or null with nothing to compare against.
export function statRank(
  facts: SuburbFactsFile,
  key: StatKey,
  value: number | null,
): number | null {
  const sorted = sortedValues(facts, key)

  if (value === null || sorted.length < 2) {
    return null
  }

  return Math.min(1, countBelow(sorted, value) / (sorted.length - 1))
}
