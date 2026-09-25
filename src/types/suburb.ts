import type { Feature, MultiPolygon, Polygon } from "geojson"

export interface SuburbProperties {
  id: string
  name: string
  lga: string
  // Label point (lon/lat), precomputed by scripts/build-suburbs.ts.
  lx: number
  ly: number
}

export type SuburbFeature = Feature<Polygon | MultiPolygon, SuburbProperties>

// Land around and under the suburbs, drawn behind them.
export type Surrounds = Feature<Polygon | MultiPolygon>

export interface SuburbMapData {
  suburbs: SuburbFeature[]
  surrounds: Surrounds
}
