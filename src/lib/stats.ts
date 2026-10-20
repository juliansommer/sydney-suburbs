import housePricePeriod from "@/data/house-price-period.json"
import type { SuburbStats } from "@/types/suburb-facts"

export type StatKey = keyof SuburbStats

export interface StatInfo {
  label: string
  // The number alone, e.g. "$2,450", for ranges in the heatmap key.
  number: (value: number) => string
  // The number with its unit, e.g. "$2,450/wk".
  format: (value: number) => string
  source: string
}

const wholeNumber = new Intl.NumberFormat("en-AU")

const dollars = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
})

// Short enough for the heatmap key, e.g. "$1.25M".
const compactDollars = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  notation: "compact",
  maximumFractionDigits: 2,
})

const monthYear = new Intl.DateTimeFormat("en-AU", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
})

const oneDecimal = new Intl.NumberFormat("en-AU", { maximumFractionDigits: 1 })

const twoDecimals = new Intl.NumberFormat("en-AU", {
  maximumFractionDigits: 2,
})

const CENSUS = "2021 Census"
const ABS_BOUNDARIES = "ABS suburb boundaries"

function stat(
  label: string,
  number: (value: number) => string,
  unit: string,
  source: string,
): StatInfo {
  return {
    label,
    number,
    format: (value) => `${number(value)}${unit}`,
    source,
  }
}

const formatDollars = (value: number) => dollars.format(value)
const formatCompactDollars = (value: number) => compactDollars.format(value)
const formatWhole = (value: number) => wholeNumber.format(value)
const formatOneDecimal = (value: number) => oneDecimal.format(value)

// A YYYY-MM month as e.g. "Jan 2025".
function formatMonth(month: string): string {
  return monthYear.format(new Date(`${month}-01T00:00:00Z`))
}

function housePriceSource(): string {
  const { from, to } = housePricePeriod

  return from && to
    ? `NSW Valuer General, houses settled ${formatMonth(from)} – ${formatMonth(to)}`
    : "NSW Valuer General"
}

export const STATS: Record<StatKey, StatInfo> = {
  medianHousePrice: stat(
    "House price",
    formatCompactDollars,
    "",
    housePriceSource(),
  ),
  landPricePerM2: stat(
    "Land price",
    formatDollars,
    "/m²",
    `${housePriceSource()}, median of price over land area`,
  ),
  medianAge: stat("Median age", String, "", CENSUS),
  bornOverseas: stat("Born overseas", String, "%", CENSUS),
  medianRent: stat("Median rent", formatDollars, "/wk", CENSUS),
  medianHouseholdIncome: stat(
    "Household income",
    formatDollars,
    "/wk",
    `${CENSUS}, median per household`,
  ),
  publicHousing: stat(
    "Housing commission",
    formatOneDecimal,
    "%",
    `${CENSUS}, share of homes rented from the state housing authority`,
  ),
  violentCrimeRate: stat(
    "Violent crime",
    formatWhole,
    " per 100k",
    "NSW BOCSAR, incidents over the latest 12 months per 100,000 residents",
  ),
  treeCanopy: stat(
    "Tree canopy",
    formatOneDecimal,
    "%",
    "NSW Department of Planning, Housing and Infrastructure, 2022 share of the suburb's urban area under tree canopy",
  ),
  areaKm2: stat(
    "Area",
    (value) => (value < 1 ? twoDecimals : oneDecimal).format(value),
    " km²",
    ABS_BOUNDARIES,
  ),
  density: stat("Density", formatWhole, "/km²", CENSUS),
}

// The order of the panel's details.
export const DETAIL_STATS: readonly StatKey[] = [
  "medianHousePrice",
  "landPricePerM2",
  "medianAge",
  "bornOverseas",
  "medianRent",
  "medianHouseholdIncome",
  "publicHousing",
  "violentCrimeRate",
  "treeCanopy",
  "areaKm2",
  "density",
]

// Area is left off, since its heatmap only shows suburb size.
export const HEATMAP_STATS = [
  "medianHousePrice",
  "landPricePerM2",
  "medianHouseholdIncome",
  "medianRent",
  "publicHousing",
  "violentCrimeRate",
  "treeCanopy",
  "density",
  "medianAge",
  "bornOverseas",
] as const satisfies readonly StatKey[]

export type HeatmapStat = (typeof HEATMAP_STATS)[number]

// Edges between the heatmap's colours, lowest first. Fixed round numbers keep
// the key readable and the same from one rebuild to the next.
export const HEATMAP_BREAKS: Record<HeatmapStat, readonly number[]> = {
  medianHousePrice: [
    1_000_000, 1_250_000, 1_500_000, 2_000_000, 3_000_000, 4_000_000,
  ],
  // Acreage sits under $500 and the eastern suburbs above $20,000, so the
  // steps widen to spread them out.
  landPricePerM2: [1000, 2500, 5000, 10_000, 15_000, 20_000],
  medianHouseholdIncome: [1000, 1500, 2000, 2500, 3000, 3500],
  medianRent: [400, 450, 500, 550, 600, 700],
  // Most suburbs have almost none, so the steps widen to spread them out.
  publicHousing: [1, 5, 10, 25, 50],
  violentCrimeRate: [250, 500, 750, 1000, 2500, 5000],
  density: [500, 1000, 2000, 3000, 4000, 6000],
  medianAge: [30, 35, 40, 45, 50],
  bornOverseas: [20, 30, 40, 50, 60, 70],
  treeCanopy: [10, 15, 20, 30, 40, 50],
}

// Something the panel can put on the map: a stat's heatmap or the top
// overseas birthplaces.
export type Overlay = HeatmapStat | "birthplace"

export const DEFAULT_HEATMAP_STAT: HeatmapStat = "medianHouseholdIncome"

export function isHeatmapStat(key: StatKey): key is HeatmapStat {
  return HEATMAP_STATS.some((s) => s === key)
}
