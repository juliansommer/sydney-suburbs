import { describe, expect, it } from "vitest"

import { suburbFacts } from "@/test/fixtures"

import { suburbFactsSchema } from "./suburb-facts"

describe("suburbFactsSchema", () => {
  it("accepts a facts file", () => {
    expect(suburbFactsSchema.parse(suburbFacts)).toStrictEqual(suburbFacts)
  })

  it("rejects a malformed one", () => {
    const malformed = {
      "1": { ...suburbFacts["1"], population: "lots" },
    }

    expect(suburbFactsSchema.safeParse(malformed).success).toBeFalsy()
  })

  it("rejects a photo missing its credit", () => {
    const { artist: _, ...photo } = suburbFacts["1"]?.photo ?? {}
    const malformed = { "1": { ...suburbFacts["1"], photo } }

    expect(suburbFactsSchema.safeParse(malformed).success).toBeFalsy()
  })
})
