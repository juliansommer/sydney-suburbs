// Builds the facts shown in the suburb panel. Run by hand with
// `pnpm build:facts`; the output is committed.
//
// Source: ABS 2021 Census General Community Profile DataPack, table G01,
//   licensed CC BY 4.0, for population.
// Source: ABS ASGS Edition 3 Postal Areas, licensed CC BY 4.0, for postcodes.

import { readFile, writeFile } from "node:fs/promises"

import { z } from "zod/mini"

import type { SuburbFactsFile } from "../src/types/suburb-facts.ts"
import { root } from "./download.ts"
import { readPopulation, readPostcodes } from "./facts/abs.ts"

const topoPath = `${root}public/sydney-suburbs.topo.json`
const factsPath = `${root}src/data/suburb-facts.json`

const topoSuburbs = z.object({
  objects: z.object({
    suburbs: z.object({
      geometries: z.array(
        z.object({
          properties: z.object({ id: z.string(), name: z.string() }),
        }),
      ),
    }),
  }),
})

interface MapSuburb {
  id: string
  name: string
}

// The map's suburbs, so the facts always cover exactly the same set.
async function readMapSuburbs(): Promise<MapSuburb[]> {
  const topo = topoSuburbs.parse(JSON.parse(await readFile(topoPath, "utf-8")))
  return topo.objects.suburbs.geometries
    .map((g) => g.properties)
    .toSorted((a, b) => a.id.localeCompare(b.id))
}

function listMissing(label: string, suburbs: MapSuburb[]) {
  if (suburbs.length === 0) {
    return
  }
  console.log(`\nNo ${label} (${suburbs.length}):`)
  for (const s of suburbs) {
    console.log(`  ${s.id} ${s.name}`)
  }
}

const suburbs = await readMapSuburbs()
const population = await readPopulation()
const postcodes = await readPostcodes(suburbs.map((s) => s.id))

const facts: SuburbFactsFile = {}
for (const s of suburbs) {
  facts[s.id] = {
    population: population.get(s.id) ?? null,
    postcode: postcodes.get(s.id) ?? null,
    summary: null,
    wikipediaUrl: null,
    photo: null,
  }
}
await writeFile(factsPath, `${JSON.stringify(facts, null, 2)}\n`)

console.log(`Suburbs: ${suburbs.length}`)
listMissing(
  "population",
  suburbs.filter((s) => facts[s.id]?.population === null),
)
listMissing(
  "postcode",
  suburbs.filter((s) => facts[s.id]?.postcode === null),
)
