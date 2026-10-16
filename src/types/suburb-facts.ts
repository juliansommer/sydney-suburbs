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

// From the 2021 Census, ABS boundaries, BOCSAR and NSW tree canopy data. Census figures are null
// where too few people live there for the ABS to publish them.
export interface SuburbStats {
  medianAge: number | null
  // Weekly, in dollars.
  medianRent: number | null
  medianHouseholdIncome: number | null
  // Percent of residents born outside Australia.
  bornOverseas: number | null
  // Percent of homes rented from the state housing authority.
  publicHousing: number | null
  // Yearly violent incidents per 100,000 residents, from BOCSAR. Null under
  // 500 residents, where one incident skews the rate.
  violentCrimeRate: number | null
  // Percent of the suburb's urban area under tree canopy in 2022. Null outside
  // Greater Sydney's urban area.
  treeCanopy: number | null
  areaKm2: number
  // People per square kilometre.
  density: number | null
}

// The most common country of birth other than Australia.
export interface TopBirthplace {
  country: string
  // Percent of residents born there.
  percent: number
}

// Precomputed by scripts/build-suburb-facts.ts.
export interface SuburbFacts {
  population: number | null
  postcode: string | null
  // One sentence on the region and what the suburb is known for.
  summary: string | null
  stats: SuburbStats
  topBirthplace: TopBirthplace | null
  photo: SuburbPhoto | null
}

// Keyed by SAL code, the same id as the map's suburbs.
export type SuburbFactsFile = Record<string, SuburbFacts>
