// Builds the facts shown in the suburb panel. Run by hand with
// `pnpm build:facts`; the output is committed.
//
// Source: ABS 2021 Census General Community Profile DataPack, table G01,
//   licensed CC BY 4.0, for population.
// Source: ABS ASGS Edition 3 Postal Areas, licensed CC BY 4.0, for postcodes.
// Source: Wikidata, CC0, to match suburbs to Wikipedia articles and photos.
//
// Pass --refresh to ignore cached Wikimedia responses.

import { readFile, writeFile } from "node:fs/promises"

import { z } from "zod/mini"

import type { SuburbFactsFile } from "../src/types/suburb-facts.ts"
import { type CacheOptions, root } from "./download.ts"
import { readPopulation, readPostcodes } from "./facts/abs.ts"
import {
  applyOverride,
  articleUrl,
  findByTitle,
  queryWikidata,
  readOverrides,
  type WikiMatch,
} from "./facts/wikipedia.ts"

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

// Wikidata first, then a title search for suburbs it doesn't know, with
// overrides applied last. One suburb at a time to keep requests polite.
async function matchSuburbs(
  suburbs: MapSuburb[],
  options: CacheOptions,
): Promise<Map<string, WikiMatch>> {
  const [wikidata, overrides] = await Promise.all([
    queryWikidata(options),
    readOverrides(),
  ])
  const matches = new Map<string, WikiMatch>()
  for (const s of suburbs) {
    const override = overrides[s.id]
    let match = wikidata.get(s.id) ?? { title: null, image: null }
    if (match.title === null && override?.title === undefined) {
      // oxlint-disable-next-line eslint/no-await-in-loop
      match = { ...match, title: await findByTitle(s.name, options) }
    }
    matches.set(s.id, applyOverride(match, override))
  }
  return matches
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

const options: CacheOptions = { refresh: process.argv.includes("--refresh") }
const suburbs = await readMapSuburbs()
const population = await readPopulation()
const postcodes = await readPostcodes(suburbs.map((s) => s.id))
const matches = await matchSuburbs(suburbs, options)

const facts: SuburbFactsFile = {}
for (const s of suburbs) {
  const title = matches.get(s.id)?.title
  facts[s.id] = {
    population: population.get(s.id) ?? null,
    postcode: postcodes.get(s.id) ?? null,
    summary: null,
    wikipediaUrl: title ? articleUrl(title) : null,
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
listMissing(
  "Wikipedia article",
  suburbs.filter((s) => facts[s.id]?.wikipediaUrl === null),
)
