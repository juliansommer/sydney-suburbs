import { describe, expect, it } from "vitest"

import { parsePopulation, stripSalPrefix } from "./abs.ts"

describe("stripSalPrefix", () => {
  it("strips the Census prefix to match our ids", () => {
    expect(stripSalPrefix("SAL12969")).toBe("12969")
  })

  it("leaves bare codes alone", () => {
    expect(stripSalPrefix("12969")).toBe("12969")
  })
})

describe("parsePopulation", () => {
  it("reads total persons by suburb id", () => {
    const csv = [
      "SAL_CODE_2021,Tot_P_M,Tot_P_F,Tot_P_P",
      "SAL10001,18,12,33",
      "SAL12969,7300,7390,14690",
      "",
    ].join("\r\n")

    expect(parsePopulation(csv)).toStrictEqual(
      new Map([
        ["10001", 33],
        ["12969", 14_690],
      ]),
    )
  })

  it("fails when the table's columns have changed", () => {
    expect(() => parsePopulation("SAL_CODE_2021,Total\nSAL10001,33")).toThrow(
      "G01 table is missing its code or total column",
    )
  })
})
