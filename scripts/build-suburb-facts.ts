// Builds the facts shown in the suburb panel. Run by hand with
// `pnpm build:facts`; the output is committed.
//
// Source: ABS 2021 Census General Community Profile DataPack, table G01,
//   licensed CC BY 4.0, for population.
// Source: ABS ASGS Edition 3 Postal Areas, licensed CC BY 4.0, for postcodes.
// Source: Wikidata, CC0, and Wikipedia, to match suburbs to photos.
// Source: Wikimedia Commons, for photos, each credited in the app.
//
// Photos are resized and uploaded to Vercel Blob, which needs
// BLOB_READ_WRITE_TOKEN. Pass --refresh to ignore cached Wikimedia
// responses, and --prune to delete photos no longer used.

import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"

import { z } from "zod/mini"

import type { SuburbFactsFile } from "../src/types/suburb-facts.ts"
import { type CacheOptions, root } from "./download.ts"
import { readPopulation, readPostcodes } from "./facts/abs.ts"
import {
  isSuitableFile,
  type PhotoSource,
  readPhotoSources,
} from "./facts/commons.ts"
import { uploadPhotos } from "./facts/photos.ts"
import {
  applyOverride,
  findByTitle,
  queryWikidata,
  readOverrides,
  readPageImages,
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

interface SuburbMatch extends WikiMatch {
  // Set when an override picked the image, so no fallback is tried.
  fixedImage: boolean
}

// Wikidata first, then a title search for suburbs it doesn't know, with
// overrides applied last. One suburb at a time to keep requests polite.
async function matchSuburbs(
  suburbs: MapSuburb[],
  options: CacheOptions,
): Promise<Map<string, SuburbMatch>> {
  const [wikidata, overrides] = await Promise.all([
    queryWikidata(options),
    readOverrides(),
  ])
  const matches = new Map<string, SuburbMatch>()
  for (const s of suburbs) {
    const override = overrides[s.id]
    let match = wikidata.get(s.id) ?? { title: null, image: null }
    if (match.title === null && override?.title === undefined) {
      // oxlint-disable-next-line eslint/no-await-in-loop
      match = { ...match, title: await findByTitle(s.name, options) }
    }
    matches.set(s.id, {
      ...applyOverride(match, override),
      fixedImage: override?.image !== undefined,
    })
  }
  return matches
}

interface PhotoChoice {
  source: PhotoSource
  fromPageImage: boolean
}

// The Wikidata image if it makes a good header, else the article's page image.
async function choosePhotos(
  matches: Map<string, SuburbMatch>,
  options: CacheOptions,
): Promise<Map<string, PhotoChoice>> {
  const titles = [...matches.values()].flatMap((m) =>
    m.title && !m.fixedImage ? [m.title] : [],
  )
  const pageImages = await readPageImages(titles, options)
  const candidates = new Map<string, string[]>()
  for (const [id, m] of matches) {
    const pageImage = m.title ? pageImages.get(m.title) : undefined
    const choices = m.fixedImage ? [m.image] : [m.image, pageImage]
    candidates.set(
      id,
      choices.filter((f): f is string => f !== null && f !== undefined),
    )
  }
  const allFiles = [...new Set([...candidates.values()].flat())]
  const sources = await readPhotoSources(
    allFiles.filter(isSuitableFile),
    options,
  )
  const photos = new Map<string, PhotoChoice>()
  for (const [id, files] of candidates) {
    const file = files.find((f) => sources.has(f))
    const source = file ? sources.get(file) : undefined
    if (file && source) {
      photos.set(id, {
        source,
        fromPageImage: file !== matches.get(id)?.image,
      })
    }
  }
  return photos
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

if (existsSync(`${root}.env`)) {
  process.loadEnvFile(`${root}.env`)
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  throw new Error("BLOB_READ_WRITE_TOKEN is not set; see .env.example")
}

const options: CacheOptions = { refresh: process.argv.includes("--refresh") }
const prune = process.argv.includes("--prune")
const suburbs = await readMapSuburbs()
const population = await readPopulation()
const postcodes = await readPostcodes(suburbs.map((s) => s.id))
const matches = await matchSuburbs(suburbs, options)

const choices = await choosePhotos(matches, options)
const upload = await uploadPhotos(
  new Map([...choices].map(([id, c]) => [id, c.source])),
  { ...options, prune },
)

const facts: SuburbFactsFile = {}
for (const s of suburbs) {
  facts[s.id] = {
    population: population.get(s.id) ?? null,
    postcode: postcodes.get(s.id) ?? null,
    photo: upload.photos.get(s.id) ?? null,
  }
}
await writeFile(factsPath, `${JSON.stringify(facts, null, 2)}\n`)

console.log(`Suburbs: ${suburbs.length}`)
console.log(`Photos uploaded: ${upload.uploaded}`)
if (prune) {
  console.log(`Photos pruned: ${upload.pruned}`)
}
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
  suburbs.filter((s) => !matches.get(s.id)?.title),
)
listMissing(
  "photo",
  suburbs.filter((s) => facts[s.id]?.photo === null),
)

// Page images are sometimes location maps, so these are worth a look.
const fromPageImages = suburbs.filter(
  (s) => choices.get(s.id)?.fromPageImage && upload.photos.has(s.id),
)
console.log(`\nPhotos from page images (${fromPageImages.length}):`)
for (const s of fromPageImages) {
  console.log(`  ${s.id} ${s.name}: ${choices.get(s.id)?.source.sourceUrl}`)
}
