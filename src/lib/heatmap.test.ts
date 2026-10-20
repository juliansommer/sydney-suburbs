import { describe, expect, it } from "vitest"

import type { SuburbFactsFile, SuburbStats } from "@/types/suburb-facts"

import { bucketOf, heatmap } from "./heatmap"

const NO_STATS: SuburbStats = {
  medianHousePrice: null,
  landPricePerM2: null,
  medianAge: null,
  medianRent: null,
  medianHouseholdIncome: null,
  bornOverseas: null,
  publicHousing: null,
  violentCrimeRate: null,
  treeCanopy: null,
  areaKm2: 1,
  density: null,
}

function factsWith(stats: Partial<SuburbStats>[]): SuburbFactsFile {
  return Object.fromEntries(
    stats.map((s, i) => [
      String(i),
      {
        population: 1000,
        postcode: null,
        summary: null,
        stats: { ...NO_STATS, ...s },
        topBirthplace: null,
        photo: null,
      },
    ]),
  )
}

function fillOf(map: ReturnType<typeof heatmap>, id: string) {
  return map.layers.fills.find((f) => f.ids.has(id))?.className
}

describe("bucketOf", () => {
  it("counts the edges at or below the value", () => {
    const breaks = [10, 20, 30]

    expect(bucketOf(5, breaks)).toBe(0)
    expect(bucketOf(10, breaks)).toBe(1)
    expect(bucketOf(29, breaks)).toBe(2)
    expect(bucketOf(400, breaks)).toBe(3)
  })
})

describe("heatmap", () => {
  it("colours suburbs from white to red by the stat's steps", () => {
    const facts = factsWith([
      { medianRent: 350 },
      { medianRent: 520 },
      { medianRent: 1200 },
    ])

    const map = heatmap("medianRent", facts)

    expect(fillOf(map, "0")).toBe("fill-heat-1")
    expect(fillOf(map, "1")).toBe("fill-heat-4")
    expect(fillOf(map, "2")).toBe("fill-heat-7")
  })

  it("keys every step, open-ended at both ends", () => {
    const facts = factsWith([{ medianRent: 500 }])

    const { buckets } = heatmap("medianRent", facts)

    expect(buckets).toHaveLength(7)
    expect(buckets[0]).toStrictEqual({
      from: null,
      to: 400,
      swatch: "bg-heat-1",
    })
    expect(buckets[1]).toMatchObject({ from: 400, to: 450 })
    expect(buckets.at(-1)).toStrictEqual({
      from: 700,
      to: null,
      swatch: "bg-heat-7",
    })
  })

  it("spreads fewer steps across the full range of colours", () => {
    const facts = factsWith([{ publicHousing: 0 }, { publicHousing: 60 }])

    const map = heatmap("publicHousing", facts)

    expect(map.buckets).toHaveLength(6)
    expect(fillOf(map, "0")).toBe("fill-heat-1")
    expect(fillOf(map, "1")).toBe("fill-heat-7")
  })

  it("colours tree canopy in greens", () => {
    const facts = factsWith([{ treeCanopy: 5 }, { treeCanopy: 60 }])

    const map = heatmap("treeCanopy", facts)

    expect(fillOf(map, "0")).toBe("fill-canopy-1")
    expect(fillOf(map, "1")).toBe("fill-canopy-7")
    expect(map.buckets.at(-1)?.swatch).toBe("bg-canopy-7")
  })

  it("greys out suburbs without a figure", () => {
    const facts = factsWith([{ medianRent: 400 }, {}])

    const map = heatmap("medianRent", facts)

    expect(map.hasNoData).toBeTruthy()
    expect(map.layers.fills[0]).toStrictEqual({
      key: "heat-none",
      ids: new Set(["1"]),
      className: "fill-heat-none",
    })
  })
})
