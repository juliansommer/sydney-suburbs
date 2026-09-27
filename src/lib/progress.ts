export interface CouncilProgress {
  lga: string
  ids: string[]
  visited: number
  total: number
}

// Visited and total suburbs per council, most complete first, then by name.
export function councilProgress(
  suburbs: readonly { id: string; lga: string }[],
  visitedIds: ReadonlySet<string>,
): CouncilProgress[] {
  const councils = new Map<string, CouncilProgress>()
  for (const { id, lga } of suburbs) {
    let council = councils.get(lga)
    if (!council) {
      council = { lga, ids: [], visited: 0, total: 0 }
      councils.set(lga, council)
    }
    council.ids.push(id)
    council.total += 1
    if (visitedIds.has(id)) {
      council.visited += 1
    }
  }
  return [...councils.values()].toSorted(
    (a, b) =>
      b.visited / b.total - a.visited / a.total || a.lga.localeCompare(b.lga),
  )
}
