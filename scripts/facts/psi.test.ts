import { describe, expect, it } from "vitest"

import {
  isHouseSale,
  medianPrices,
  MIN_PRICE,
  missingWeeks,
  parseSale,
  periodFor,
  type Sale,
  uniqueSales,
} from "./psi.ts"

// A "B" record laid out as in the Valuer General's file format fact sheet.
const RECORD =
  "B;001;1234567;3;20250106 01:02;;;12;SMITH ST;PUNCHBOWL;2196;556.6;M;20241120;20250103;1250000;R2;R;;;;;;AU123456;"

function sale(overrides: Partial<Sale> = {}): Sale {
  return {
    district: "001",
    propertyId: "1",
    dealing: "AU1",
    downloaded: "20250106 01:02",
    locality: "PUNCHBOWL",
    postcode: "2196",
    areaM2: 500,
    settlementDate: "20250310",
    price: 1_000_000,
    nature: "R",
    strataLot: "",
    interest: "",
    ...overrides,
  }
}

// Weekly file days from `from` to `to`, as CCYYMMDD.
function weeks(from: string, to: string): string[] {
  const days: string[] = []
  const end = Date.parse(to)

  for (let d = Date.parse(from); d <= end; d += 7 * 86_400_000) {
    days.push(new Date(d).toISOString().slice(0, 10).replaceAll("-", ""))
  }

  return days
}

describe("parseSale", () => {
  it("reads the fields of a sale record", () => {
    expect(parseSale(RECORD)).toStrictEqual({
      district: "001",
      propertyId: "1234567",
      dealing: "AU123456",
      downloaded: "20250106 01:02",
      locality: "PUNCHBOWL",
      postcode: "2196",
      areaM2: 556.6,
      settlementDate: "20250103",
      price: 1_250_000,
      nature: "R",
      strataLot: "",
      interest: "",
    })
  })

  it("reads hectares as square metres and a missing area as null", () => {
    expect(parseSale(RECORD.replace("556.6;M", "2;H"))?.areaM2).toBe(20_000)
    expect(parseSale(RECORD.replace("556.6;M", ";"))?.areaM2).toBeNull()
  })

  it("skips other records", () => {
    expect(parseSale("A;RTSALEDATA;001;20250106 01:02;;")).toBeNull()
    expect(parseSale("C;001;1234567;3;20250106 01:02;LOT 1 DP123;")).toBeNull()
  })
})

describe("isHouseSale", () => {
  it("keeps whole residences at a real price", () => {
    expect(isHouseSale(sale())).toBeTruthy()
    expect(isHouseSale(sale({ interest: "0" }))).toBeTruthy()
  })

  it("drops units, land, part shares and nominal prices", () => {
    expect(isHouseSale(sale({ strataLot: "4" }))).toBeFalsy()
    expect(isHouseSale(sale({ nature: "V" }))).toBeFalsy()
    expect(isHouseSale(sale({ interest: "50" }))).toBeFalsy()
    expect(isHouseSale(sale({ price: MIN_PRICE - 1 }))).toBeFalsy()
  })
})

describe("uniqueSales", () => {
  it("keeps the latest copy of a sale sent twice", () => {
    const first = sale({ price: 900_000, downloaded: "20250106 01:00" })
    const later = sale({ price: 950_000, downloaded: "20250113 01:00" })

    expect(uniqueSales([later, first])).toStrictEqual([later])
  })

  it("drops dealings that cover several properties", () => {
    const single = sale({ dealing: "AU2" })

    const bulk = [
      sale({ dealing: "AU3", propertyId: "10" }),
      sale({ dealing: "AU3", propertyId: "11" }),
    ]

    expect(uniqueSales([single, ...bulk])).toStrictEqual([single])
  })
})

describe("periodFor", () => {
  it("ends with the month the latest file covers", () => {
    expect(periodFor(["20250106", "20251229"])).toStrictEqual({
      from: "2025-01",
      to: "2025-12",
    })
  })

  it("ends the month before when the latest file is mid-month", () => {
    expect(periodFor(["20251013"])).toStrictEqual({
      from: "2024-10",
      to: "2025-09",
    })
  })

  it("is null without files", () => {
    expect(periodFor([])).toBeNull()
  })
})

describe("medianPrices", () => {
  const period = { from: "2025-01", to: "2025-12" }

  it("takes the median per locality, rounded to $1,000", () => {
    const prices = [
      1_000_400, 1_200_000, 900_000, 1_100_000, 2_000_000, 950_000,
    ]

    const sales = prices.map((price) => sale({ price }))

    expect(medianPrices(sales, period).get("punchbowl")).toStrictEqual({
      median: 1_050_000,
      sales: 6,
      medianPerM2: 2100,
    })
  })

  it("takes price per square metre from sales with a real land area", () => {
    const sales = [
      ...[250, 400, 500, 800, 1000].map((areaM2) => sale({ areaM2 })),
      sale({ areaM2: null }),
      sale({ areaM2: 10 }),
    ]

    expect(medianPrices(sales, period).get("punchbowl")?.medianPerM2).toBe(2000)
  })

  it("leaves out price per square metre with too few areas", () => {
    const sales = Array.from({ length: 5 }, (_, i) =>
      sale({ areaM2: i === 0 ? 500 : null }),
    )

    expect(medianPrices(sales, period).get("punchbowl")?.medianPerM2).toBeNull()
  })

  it("leaves out sales settled outside the period and non-houses", () => {
    const sales = [
      ...Array.from({ length: 4 }, () => sale()),
      sale({ settlementDate: "20241231" }),
      sale({ strataLot: "2" }),
    ]

    expect(medianPrices(sales, period).has("punchbowl")).toBeFalsy()
  })
})

describe("missingWeeks", () => {
  const period = { from: "2025-01", to: "2025-12" }

  it("finds nothing when every week is there", () => {
    expect(
      missingWeeks(weeks("2025-01-06", "2025-12-29"), period),
    ).toStrictEqual([])
  })

  it("names a skipped week", () => {
    const days = weeks("2025-01-06", "2025-12-29").filter(
      (d) => d !== "20250317",
    )

    expect(missingWeeks(days, period)).toStrictEqual([
      "2025-03-10 to 2025-03-24",
    ])
  })

  it("names missing weeks at the start", () => {
    expect(
      missingWeeks(weeks("2025-02-03", "2025-12-29"), period),
    ).toStrictEqual(["2025-01-01 to 2025-02-03"])
  })
})
