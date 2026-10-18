import {
  COUNTRIES,
  type Country,
  type CountryColour,
  NO_BIRTHPLACE,
  OTHER_COUNTRY,
} from "@/data/birthplace-countries"
import { mergeSuburbs } from "@/queries/suburbs-topo"
import type { FillLayer, MapLayers } from "@/types/map-layers"
import type { SuburbMapData } from "@/types/suburb"
import type { SuburbFactsFile } from "@/types/suburb-facts"

// Fills each suburb with the flag of its most common overseas birthplace, and
// outlines each run of suburbs sharing one.
export function birthplaceLayers(
  facts: SuburbFactsFile,
  { suburbs, topology }: SuburbMapData,
): MapLayers {
  const byLabel = new Map(COUNTRIES.map((c) => [c.label, c]))

  const countryOf = (id: string): Country | CountryColour => {
    const top = facts[id]?.topBirthplace?.country

    if (top === undefined) {
      return NO_BIRTHPLACE
    }

    return byLabel.get(top) ?? OTHER_COUNTRY
  }

  const members = new Map<string, Set<string>>()

  for (const { properties } of suburbs) {
    const { key } = countryOf(properties.id)
    members.set(key, (members.get(key) ?? new Set()).add(properties.id))
  }

  const fills: FillLayer[] = [
    ...[OTHER_COUNTRY, NO_BIRTHPLACE].map((c) => ({
      key: `country-${c.key}`,
      ids: members.get(c.key) ?? new Set<string>(),
      className: c.fill,
    })),
    ...COUNTRIES.map((c) => ({
      key: `country-${c.key}`,
      ids: members.get(c.key) ?? new Set<string>(),
      className: OTHER_COUNTRY.fill,
      image: c.flag,
    })),
  ]

  const regions = mergeSuburbs(topology, (s) => countryOf(s.id).key)

  return {
    fills: fills.filter((f) => f.ids.size > 0),
    outlines: [...regions].map(([key, geometry]) => ({
      key,
      feature: { type: "Feature", geometry, properties: {} },
    })),
    markers: [],
  }
}
