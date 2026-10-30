import { describe, expect, it } from "vitest"

import type { SuburbFacts, SuburbFactsFile } from "@/types/suburb-facts"

import { statRank } from "./compare"
import { fitBounds, unionBounds } from "./zoom"

function withRent(medianRent: number | null): SuburbFacts {
  return {
    population: null,
    postcode: null,
    summary: null,
    topBirthplace: null,
    photo: null,
    stats: {
      medianHousePrice: null,
      landPricePerM2: null,
      medianAge: null,
      medianRent,
      medianHouseholdIncome: null,
      bornOverseas: null,
      publicHousing: null,
      violentCrimeRate: null,
      treeCanopy: null,
      areaKm2: 1,
      density: null,
    },
  }
}

const facts: SuburbFactsFile = {
  a: withRent(400),
  b: withRent(500),
  c: withRent(600),
  d: withRent(null),
}

describe("statRank", () => {
  it("places a value between the lowest and highest suburb", () => {
    expect(statRank(facts, "medianRent", 400)).toBe(0)
    expect(statRank(facts, "medianRent", 500)).toBe(0.5)
    expect(statRank(facts, "medianRent", 600)).toBe(1)
  })

  it("has no rank without a value, or without others to rank against", () => {
    expect(statRank(facts, "medianRent", null)).toBeNull()
    expect(statRank(facts, "medianAge", 30)).toBeNull()
  })
})

describe("unionBounds", () => {
  it("covers every box", () => {
    expect(
      unionBounds([
        [
          [0, 5],
          [2, 6],
        ],
        [
          [1, 0],
          [4, 3],
        ],
      ]),
    ).toStrictEqual([
      [0, 0],
      [4, 6],
    ])
  })
})

describe("fitBounds", () => {
  it("centres in the part of the viewport the panel leaves clear", () => {
    const bounds: [[number, number], [number, number]] = [
      [0, 0],
      [10, 10],
    ]

    const target = fitBounds(bounds, 1000, 600, 2, { right: 400, bottom: 0 })

    // The box's centre lands halfway across the 600 pixels left uncovered.
    expect(target.x + target.k * 5).toBe(300)
    expect(target.y + target.k * 5).toBe(300)
  })
})
