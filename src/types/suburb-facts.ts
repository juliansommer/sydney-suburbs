export interface SuburbPhoto {
  // Vercel Blob URL.
  url: string
  width: number
  height: number
  artist: string
  // Licence name, e.g. "CC BY-SA 4.0".
  licence: string
  licenceUrl: string
  // Commons file page.
  sourceUrl: string
}

// From the 2021 Census and ABS boundaries. Census figures are null where too
// few people live there for the ABS to publish them.
export interface SuburbStats {
  medianAge: number | null
  // Weekly, in dollars.
  medianRent: number | null
  medianHouseholdIncome: number | null
  // Percent of residents born outside Australia.
  bornOverseas: number | null
  areaKm2: number
  // People per square kilometre.
  density: number | null
  // Straight line from Sydney Town Hall.
  cbdDistanceKm: number
}

// Precomputed by scripts/build-suburb-facts.ts.
export interface SuburbFacts {
  population: number | null
  postcode: string | null
  // One sentence on the region and what the suburb is known for.
  summary: string | null
  stats: SuburbStats
  photo: SuburbPhoto | null
}

// Keyed by SAL code, the same id as the map's suburbs.
export type SuburbFactsFile = Record<string, SuburbFacts>
