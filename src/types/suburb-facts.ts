export interface SuburbPhoto {
  // Vercel Blob URL.
  url: string
  width: number
  height: number
  // Placeholder colour shown while the photo loads, as #rrggbb.
  color: string
  artist: string
  // Licence name, e.g. "CC BY-SA 4.0".
  licence: string
  licenceUrl: string
  // Commons file page.
  sourceUrl: string
}

// Precomputed by scripts/build-suburb-facts.ts.
export interface SuburbFacts {
  population: number | null
  postcode: string | null
  summary: string | null
  wikipediaUrl: string | null
  photo: SuburbPhoto | null
}

// Keyed by SAL code, the same id as the map's suburbs.
export type SuburbFactsFile = Record<string, SuburbFacts>
