import { geoArea, geoCentroid, geoContains, geoDistance } from "d3-geo"
import type { Polygon } from "geojson"

import {
  CLUB_IDS,
  CLUBS,
  type ClubId,
  clubFor,
  clubLogo,
} from "@/data/nrl-territories"
import { mergeSuburbs } from "@/queries/suburbs-topo"
import type { MapLayers, MapMarker } from "@/types/map-layers"
import type { SuburbMapData, SuburbProperties } from "@/types/suburb"

const EARTH_RADIUS_KM = 6371
// Pieces of a territory smaller than this get no logo of their own.
export const MIN_LOGO_AREA_KM2 = 20

// The centre of the piece, or for a curved piece whose centre falls outside
// it, the label point of its suburb nearest that centre.
function logoPoint(
  polygon: Polygon,
  suburbs: SuburbProperties[],
): [number, number] | undefined {
  const centre = geoCentroid(polygon)
  if (geoContains(polygon, centre)) {
    return centre
  }
  const labels = suburbs
    .map((s): [number, number] => [s.lx, s.ly])
    .filter((point) => geoContains(polygon, point))
  return labels.toSorted(
    (a, b) => geoDistance(a, centre) - geoDistance(b, centre),
  )[0]
}

function logoMarkers(
  club: ClubId,
  coordinates: Polygon["coordinates"][],
  suburbs: SuburbProperties[],
): MapMarker[] {
  return coordinates.flatMap((rings, i) => {
    const polygon: Polygon = { type: "Polygon", coordinates: rings }
    const areaKm2 = geoArea(polygon) * EARTH_RADIUS_KM ** 2
    const point =
      areaKm2 < MIN_LOGO_AREA_KM2 ? undefined : logoPoint(polygon, suburbs)
    return point
      ? [
          {
            key: `${club}-${i}`,
            coords: point,
            src: clubLogo(club),
            label: CLUBS[club].name,
          },
        ]
      : []
  })
}

// Fills each suburb in its club's colour, outlines each territory, and puts
// a logo in every sizeable piece of it.
export function nrlLayers({ suburbs, topology }: SuburbMapData): MapLayers {
  const territories = mergeSuburbs(topology, clubFor)
  const layers: MapLayers = { fills: [], outlines: [], markers: [] }
  for (const club of CLUB_IDS) {
    const geometry = territories.get(club)
    if (!geometry) {
      continue
    }
    const members = suburbs
      .map((s) => s.properties)
      .filter((s) => clubFor(s) === club)
    layers.fills.push({
      key: club,
      ids: new Set(members.map((s) => s.id)),
      className: CLUBS[club].fill,
    })
    layers.outlines.push({
      key: club,
      feature: { type: "Feature", geometry, properties: {} },
    })
    layers.markers.push(...logoMarkers(club, geometry.coordinates, members))
  }
  return layers
}
