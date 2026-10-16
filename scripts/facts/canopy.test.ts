import { describe, expect, it } from "vitest"

import {
  canopyRows,
  matchCanopy,
  MIN_URBAN_SHARE,
  parseSharedStrings,
  parseSheet,
} from "./canopy.ts"

const STRINGS = [
  "Suburb Reference",
  "Suburb (MUA) (ha)",
  "2022 MUA Canopy %",
  "ABBOTSBURY",
  "Notes",
]

const SHEET = [
  "<sheetData>",
  '<row r="1"><c r="A1" t="s"><v>4</v></c><c r="B1" s="82"/></row>',
  '<row r="5"><c r="A5" t="s"><v>0</v></c><c r="B5" t="s"><v>1</v></c>',
  '<c r="D5" t="s"><v>2</v></c></row>',
  '<row r="6"><c r="A6" t="s"><v>3</v></c><c r="B6" s="43"><v>147.8</v></c>',
  '<c r="C6"><v>13.2</v></c><c r="D6" s="3"><v>8.9300000000000004E-2</v></c></row>',
  "</sheetData>",
].join("")

describe("parseSharedStrings", () => {
  it("decodes entities and joins rich text runs", () => {
    const xml =
      "<sst><si><t>Fish &amp; Chips</t></si><si><r><t>A</t></r><r><t>B</t></r></si></sst>"

    expect(parseSharedStrings(xml)).toStrictEqual(["Fish & Chips", "AB"])
  })
})

describe("canopyRows", () => {
  it("reads each suburb's urban area and canopy below the header", () => {
    expect(canopyRows(parseSheet(SHEET, STRINGS))).toStrictEqual(
      new Map([["ABBOTSBURY", { areaHa: 147.8, canopy: 0.0893 }]]),
    )
  })

  it("fails when the header has changed", () => {
    expect(() => canopyRows(parseSheet(SHEET, ["Suburb"]))).toThrow(
      'No "Suburb Reference" header',
    )
  })
})

describe("matchCanopy", () => {
  const rows = new Map([["ABBOTSBURY", { areaHa: 147.8, canopy: 0.0893 }]])

  it("matches names regardless of case, as a percent", () => {
    expect(
      matchCanopy([{ id: "1", name: "Abbotsbury", areaKm2: 1.5 }], rows),
    ).toStrictEqual(new Map([["1", 8.9]]))
  })

  it("skips suburbs mostly outside the urban area", () => {
    const areaKm2 = 147.8 / 100 / MIN_URBAN_SHARE + 1

    expect(
      matchCanopy([{ id: "1", name: "Abbotsbury", areaKm2 }], rows),
    ).toStrictEqual(new Map())
  })
})
