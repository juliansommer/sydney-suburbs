import { describe, expect, it } from "vitest"

import { MIN_POPULATION, topBirthplace } from "./birthplace.ts"

describe("topBirthplace", () => {
  it("picks the country with the most residents", () => {
    expect(
      topBirthplace(
        { P_India_Tot: 410, P_Nepal_Tot: 520, P_Korea_South_Tot: 12 },
        4000,
      ),
    ).toStrictEqual({ country: "Nepal", percent: 13 })
  })

  it("has none where no one was born overseas", () => {
    expect(topBirthplace({}, 500)).toBeNull()
  })

  it("has none for tiny populations", () => {
    expect(topBirthplace({ P_Fiji_Tot: 20 }, MIN_POPULATION - 1)).toBeNull()
  })
})
