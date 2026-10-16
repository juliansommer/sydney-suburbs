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
const formatWhole = (value: number) => wholeNumber.format(value)
const formatOneDecimal = (value: number) => oneDecimal.format(value)

export const STATS: Record<StatKey, StatInfo> = {
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
  areaKm2: stat(
    "Area",
    (value) => (value < 1 ? twoDecimals : oneDecimal).format(value),
    " km²",
    ABS_BOUNDARIES,
  ),
  density: stat("Density", formatWhole, "/km²", CENSUS),
  cbdDistanceKm: stat(
    "Straight line to CBD",
    formatOneDecimal,
    " km",
    `${ABS_BOUNDARIES}, from Sydney Town Hall`,
  ),
}

// The order of the panel's details.
export const DETAIL_STATS: readonly StatKey[] = [
  "medianAge",
  "bornOverseas",
  "medianRent",
  "medianHouseholdIncome",
  "publicHousing",
  "violentCrimeRate",
  "areaKm2",
  "density",
  "cbdDistanceKm",
]

// Area and distance to the CBD are left off, since their heatmaps only show
// suburb size and geography.
export const HEATMAP_STATS = [
  "medianHouseholdIncome",
  "medianRent",
  "publicHousing",
  "violentCrimeRate",
  "density",
  "medianAge",
  "bornOverseas",
] as const satisfies readonly StatKey[]

export type HeatmapStat = (typeof HEATMAP_STATS)[number]

// Edges between the heatmap's colours, lowest first. Fixed round numbers keep
// the key readable and the same from one rebuild to the next.
export const HEATMAP_BREAKS: Record<HeatmapStat, readonly number[]> = {
  medianHouseholdIncome: [1000, 1500, 2000, 2500, 3000, 3500],
  medianRent: [400, 450, 500, 550, 600, 700],
  // Most suburbs have almost none, so the steps widen to spread them out.
  publicHousing: [1, 5, 10, 25, 50],
  violentCrimeRate: [250, 500, 750, 1000, 2500, 5000],
  density: [500, 1000, 2000, 3000, 4000, 6000],
  medianAge: [30, 35, 40, 45, 50],
  bornOverseas: [20, 30, 40, 50, 60, 70],
}

export const DEFAULT_HEATMAP_STAT: HeatmapStat = "medianHouseholdIncome"

export function isHeatmapStat(key: StatKey): key is HeatmapStat {
  return HEATMAP_STATS.some((s) => s === key)
}
