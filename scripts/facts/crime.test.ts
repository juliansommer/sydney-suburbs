import { describe, expect, it } from "vitest"

import { crimeRate, matchSuburbs, splitRow, tallyViolent } from "./crime.ts"

// Two years of months, so the tally has to skip the older one.
const MONTHS = [
  "Jan 2024",
  "Feb 2024",
  "Mar 2024",
  "Apr 2024",
  "May 2024",
  "Jun 2024",
  "Jul 2024",
  "Aug 2024",
  "Sep 2024",
  "Oct 2024",
  "Nov 2024",
  "Dec 2024",
  "Jan 2025",
  "Feb 2025",
  "Mar 2025",
  "Apr 2025",
  "May 2025",
  "Jun 2025",
  "Jul 2025",
  "Aug 2025",
  "Sep 2025",
  "Oct 2025",
  "Nov 2025",
  "Dec 2025",
]

function row(suburb: string, category: string, subcategory: string) {
  // 100 a month in the older year, then 1 to 12 in the latest one.
  const counts = MONTHS.map((_, i) => (i < 12 ? 100 : i - 11))

  return [suburb, category, subcategory, ...counts]
    .map((cell) => `"${cell}"`)
    .join(",")
}

const header = ["Suburb", "Offence category", "Subcategory", ...MONTHS]
  .map((cell) => `"${cell}"`)
  .join(",")

describe("splitRow", () => {
  it("keeps commas inside quoted cells", () => {
    expect(
      splitRow('"Alpha","Homicide","Murder accessory, conspiracy","0"'),
    ).toStrictEqual(["Alpha", "Homicide", "Murder accessory, conspiracy", "0"])
  })
})

describe("tallyViolent", () => {
  it("adds up violent offences over the latest 12 months", () => {
    const tallies = tallyViolent(header, [
      row("Alpha", "Assault", "Domestic violence related assault"),
      row("Alpha", "Robbery", "Robbery without a weapon"),
      row("Alpha", "Theft", "Motor vehicle theft"),
      row("Beta", "Homicide", "Murder accessory, conspiracy"),
    ])

    expect(tallies).toStrictEqual(
      new Map([
        ["Alpha", 156],
        ["Beta", 78],
      ]),
    )
  })
})

describe("matchSuburbs", () => {
  it("prefers the name with its council for names shared across NSW", () => {
    const tallies = new Map([
      ["Alpha", 10],
      ["Punchbowl (Canterbury-Bankstown)", 20],
      ["Punchbowl (Clarence Valley)", 30],
    ])

    expect(
      matchSuburbs(
        [
          { id: "1", name: "Alpha", lga: "Sydney" },
          { id: "2", name: "Punchbowl", lga: "Canterbury-Bankstown" },
          { id: "3", name: "Gamma", lga: "Sydney" },
        ],
        tallies,
      ),
    ).toStrictEqual(
      new Map([
        ["1", 10],
        ["2", 20],
      ]),
    )
  })
})

describe("crimeRate", () => {
  it("gives incidents per 100,000 residents", () => {
    expect(crimeRate(30, 4000)).toBe(750)
  })

  it("leaves out places with too few residents or no figures", () => {
    expect(crimeRate(3, 120)).toBeNull()
    expect(crimeRate(undefined, 4000)).toBeNull()
    expect(crimeRate(3, null)).toBeNull()
  })
})
