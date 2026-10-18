import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import type { SuburbFactsFile } from "@/types/suburb-facts"

import { COUNTRIES } from "./birthplace-countries"

const facts = JSON.parse(
  readFileSync("src/data/suburb-facts.json", "utf-8"),
) as SuburbFactsFile

describe("birthplace countries", () => {
  // The key has no "Other" entry, so every top country needs a flag.
  it("has a flag for every suburb's top birthplace", () => {
    const labels = new Set(COUNTRIES.map((c) => c.label))

    const missing = Object.values(facts)
      .map((f) => f.topBirthplace?.country)
      .filter((c) => c !== undefined && !labels.has(c))

    expect([...new Set(missing)]).toStrictEqual([])
  })
})
