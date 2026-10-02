import { describe, expect, it } from "vitest"

import {
  distanceKm,
  parseTable,
  stripSalPrefix,
  SYDNEY_CBD,
  toCensusFacts,
} from "./abs.ts"

describe("stripSalPrefix", () => {
  it("strips the Census prefix to match our ids", () => {
    expect(stripSalPrefix("SAL12969")).toBe("12969")
  })

  it("leaves bare codes alone", () => {
    expect(stripSalPrefix("12969")).toBe("12969")
  })
})

describe("parseTable", () => {
  it("reads the asked-for columns by suburb id", () => {
    const csv = [
      "SAL_CODE_2021,Tot_P_M,Tot_P_F,Tot_P_P",
      "SAL10001,18,12,33",
      "SAL12969,7300,7390,14690",
      "",
    ].join("\r\n")

    expect(parseTable(csv, ["Tot_P_P"])).toStrictEqual(
      new Map([
        ["10001", { Tot_P_P: 33 }],
        ["12969", { Tot_P_P: 14_690 }],
      ]),
    )
  })

  it("fails when the table's columns have changed", () => {
    expect(() =>
      parseTable("SAL_CODE_2021,Total\nSAL10001,33", ["Tot_P_P"]),
    ).toThrow("Census table is missing Tot_P_P")
  })
})

describe("toCensusFacts", () => {
  it("works out the share born overseas from those who answered", () => {
    expect(
      toCensusFacts(
        {
          Tot_P_P: 16_667,
          Birthplace_Australia_P: 3717,
          Birthplace_Elsewhere_P: 11_811,
        },
        {
          Median_age_persons: 32,
          Median_rent_weekly: 600,
          Median_tot_hhd_inc_weekly: 2227,
        },
      ),
    ).toStrictEqual({
      population: 16_667,
      medianAge: 32,
      medianRent: 600,
      medianHouseholdIncome: 2227,
      bornOverseas: 76,
    })
  })

  it("treats a median of zero as unknown", () => {
    expect(
      toCensusFacts(
        { Tot_P_P: 3, Birthplace_Australia_P: 0, Birthplace_Elsewhere_P: 0 },
        {
          Median_age_persons: 0,
          Median_rent_weekly: 0,
          Median_tot_hhd_inc_weekly: 0,
        },
      ),
    ).toStrictEqual({
      population: 3,
      medianAge: null,
      medianRent: null,
      medianHouseholdIncome: null,
      bornOverseas: null,
    })
  })
})

describe("distanceKm", () => {
  it("measures from the CBD", () => {
    const parramatta = { lon: 151.0036, lat: -33.8148 }

    expect(distanceKm(SYDNEY_CBD, SYDNEY_CBD)).toBe(0)
    expect(distanceKm(parramatta, SYDNEY_CBD)).toBeCloseTo(19.7, 0)
  })
})
