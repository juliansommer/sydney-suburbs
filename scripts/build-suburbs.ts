// Builds the suburb map and the suburbs seed migration from ABS boundaries.
// Run by hand with `pnpm build:suburbs`; outputs are committed.
//
// Source: ABS ASGS Edition 3 (2021), licensed CC BY 4.0.
//   Suburbs and Localities (SAL), filtered to Greater Sydney (GCCSA 1GSYD),
//   with each suburb's LGA attached, minus the outer councils below.
//   Mesh Blocks, for parks and water inside the mapped suburbs.

import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { gzipSync } from "node:zlib"

import geo from "mapshaper"
import polylabel from "polylabel"
import { z } from "zod"

// Everything tied to the ASGS edition lives here, so moving to Edition 4
// (2026) is a matter of updating this block.
const SOURCE = {
  baseUrl:
    "https://www.abs.gov.au/statistics/standards/australian-statistical-geography-standard-asgs-edition-3/jul2021-jun2026/access-and-downloads/digital-boundary-files",
  sal: "SAL_2021_AUST_GDA2020_SHP.zip",
  gccsa: "GCCSA_2021_AUST_SHP_GDA2020.zip",
  lga: "LGA_2021_AUST_GDA2020_SHP.zip",
  mb: "MB_2021_AUST_SHP_GDA2020.zip",
  fields: {
    state: "STE_CODE21",
    gccsa: "GCC_CODE21",
    salCode: "SAL_CODE21",
    salName: "SAL_NAME21",
    lgaName: "LGA_NAME21",
    mbCategory: "MB_CAT21",
  },
  nsw: "1",
  greaterSydney: "1GSYD",
} as const

// The ABS Greater Sydney area stretches to the Central Coast and Blue
// Mountains. We stop at Penrith, Campbelltown and the Hawkesbury River by
// dropping these councils (names after disambiguators are stripped).
const EXCLUDED_LGAS = [
  "Blue Mountains",
  "Central Coast",
  "Oberon",
  "Wollondilly",
]

const EXCLUDED_SUBURBS = [
  // National park, with next to nobody living there.
  "Ku-ring-gai Chase",
  "Royal National Park",
  // Rural fringe north of Glenorie.
  "Canoelands",
  "Cattai",
  "Fiddletown",
  "Forest Glen",
  "Laughtondale",
  "Leets Vale",
  "Lower Portland",
  "Maroota",
  "Sackville North",
  "Singletons Mill",
  "South Maroota",
  "Wisemans Ferry",
  // Hawkesbury River settlements past Berowra.
  "Brooklyn",
  "Cowan",
  "Dangar Island",
  "Milsons Passage",
  // Hawkesbury council outside the Windsor-Richmond towns: across the river,
  // the floodplain between the towns, Scheyville park, and the rural west.
  "Berambing",
  "Bilpin",
  "Blaxlands Ridge",
  "Bowen Mountain",
  "Central Colo",
  "Central Macdonald",
  "Colo",
  "Colo Heights",
  "Cornwallis",
  "Cumberland Reach",
  "East Kurrajong",
  "Ebenezer",
  "Fernances",
  "Freemans Reach",
  "Glossodia",
  "Grose Vale",
  "Grose Wold",
  "Higher Macdonald",
  "Kurmond",
  "Kurrajong",
  "Kurrajong Heights",
  "Kurrajong Hills",
  "Lower Macdonald",
  "Mellong",
  "Mogo Creek",
  "Mountain Lagoon",
  "North Richmond",
  "Perrys Crossing",
  "Pitt Town Bottoms",
  "Richmond Lowlands",
  "Sackville",
  "Scheyville",
  "St Albans",
  "Ten Mile Hollow",
  "Tennyson",
  "The Devils Wilderness",
  "The Slopes",
  "Upper Colo",
  "Upper Macdonald",
  "Webbs Creek",
  "Wheeny Creek",
  "Wilberforce",
  "Womerah",
  "Wrights Creek",
  "Yarramundi",
]

// Councils for suburbs whose inner point lands in the wrong one. Holsworthy
// is mostly Army land in Campbelltown; its houses are all in Liverpool.
const LGA_OVERRIDES = { Holsworthy: "Liverpool" } satisfies Record<
  string,
  string
>

// Land around the map is drawn from every locality inside this box
// [west, south, east, north], so wide screens don't show land ending at a
// straight edge. Coarser simplification keeps it small.
const SURROUNDS_BBOX = [148.5, -35.5, 153.5, -32]
const SURROUNDS_SIMPLIFY_METRES = 500

// Mesh block categories drawn as land use, and the smallest patch kept in
// square metres. Small parks would add points without being visible.
const LANDUSE_CATEGORIES = ["Parkland", "Water"]
const LANDUSE_MIN_AREA = 100_000

// Simplification tolerance in metres. A fixed distance, unlike a percentage,
// doesn't shift when other steps change what mapshaper has loaded.
const SIMPLIFY_METRES = 150
const MIN_SUBURBS = 600
const MAX_SUBURBS = 700
const MAX_GZIP_BYTES = 400 * 1024
// D1 caps statement size, so the seed inserts in chunks.
const SEED_CHUNK = 200

const root = fileURLToPath(new URL("..", import.meta.url))
const cacheDir = `${root}.cache/abs/`
const topoPath = `${root}public/sydney-suburbs.topo.json`
const migrationsDir = `${root}drizzle/migrations/`

const point = z.tuple([z.number(), z.number()])
const ring = z.array(point)
const polygon = z.array(ring)
const suburbCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(
    z.object({
      type: z.literal("Feature"),
      geometry: z.discriminatedUnion("type", [
        z.object({ type: z.literal("Polygon"), coordinates: polygon }),
        z.object({
          type: z.literal("MultiPolygon"),
          coordinates: z.array(polygon),
        }),
      ]),
      properties: z.object({
        id: z.string().min(1),
        name: z.string().min(1),
        lga: z.string().min(1),
      }),
    }),
  ),
})

type Ring = z.infer<typeof ring>
type Geometry = z.infer<typeof suburbCollection>["features"][number]["geometry"]
type Suburb = z.infer<typeof suburbCollection>["features"][number]["properties"]

async function download(file: string) {
  const path = cacheDir + file
  if (existsSync(path)) {
    return
  }
  console.log(`Downloading ${file}`)
  const res = await fetch(`${SOURCE.baseUrl}/${file}`)
  if (!res.ok) {
    throw new Error(`Download failed: ${file} (${res.status})`)
  }
  await writeFile(path, new Uint8Array(await res.arrayBuffer()))
}

async function buildGeoJson() {
  const f = SOURCE.fields
  const out = await geo.applyCommands(
    [
      `-i "${cacheDir}${SOURCE.gccsa}" name=gcc`,
      `-filter '${f.gccsa} === "${SOURCE.greaterSydney}"'`,
      `-i "${cacheDir}${SOURCE.lga}" name=lga`,
      `-filter '${f.state} === "${SOURCE.nsw}"'`,
      `-i "${cacheDir}${SOURCE.sal}" name=sal`,
      `-filter '${f.state} === "${SOURCE.nsw}"'`,
      // A suburb is in Greater Sydney if its inner point is.
      `-join target=sal gcc point-method fields=${f.gccsa}`,
      `-filter '${f.gccsa} === "${SOURCE.greaterSydney}"'`,
      // Strip ABS disambiguators: "Mount Pleasant (Penrith - NSW)", "Bayside (NSW)".
      `-each 'id = ${f.salCode}, name = ${f.salName}.replace(/ \\(.*\\)$/, "")'`,
      `-filter '!${JSON.stringify(EXCLUDED_SUBURBS)}.includes(name)'`,
      `-join lga point-method fields=${f.lgaName}`,
      `-each 'lga = ${JSON.stringify(LGA_OVERRIDES)}[name] ?? ${f.lgaName}.replace(/ \\(.*\\)$/, "")'`,
      `-filter '!${JSON.stringify(EXCLUDED_LGAS)}.includes(lga)'`,
      "-filter-fields id,name,lga",
      `-simplify visvalingam weighted interval=${SIMPLIFY_METRES} keep-shapes`,
      "-o suburbs.json format=geojson precision=0.00001",
    ].join(" "),
  )
  return suburbCollection.parse(JSON.parse(out["suburbs.json"] ?? "null"))
}

// Parks and water, clipped to the simplified suburbs so they never spill past
// a coastline that simplification has moved.
async function buildLanduse(suburbsJson: string) {
  const f = SOURCE.fields
  const out = await geo.applyCommands(
    [
      "-i suburbs.json name=suburbs",
      `-i "${cacheDir}${SOURCE.mb}" name=landuse`,
      `-filter '${f.gccsa} === "${SOURCE.greaterSydney}" && ${JSON.stringify(LANDUSE_CATEGORIES)}.includes(${f.mbCategory})'`,
      `-dissolve ${f.mbCategory}`,
      "-explode",
      `-filter 'this.area > ${LANDUSE_MIN_AREA}'`,
      `-simplify visvalingam weighted interval=${SIMPLIFY_METRES} keep-shapes`,
      "-clip suburbs",
      `-filter 'this.area > ${LANDUSE_MIN_AREA / 10}'`,
      `-dissolve ${f.mbCategory}`,
      `-each 'kind = ${f.mbCategory}.toLowerCase()'`,
      "-filter-fields kind",
      "-o landuse.json format=geojson precision=0.00001",
    ].join(" "),
    { "suburbs.json": suburbsJson },
  )
  const landuse = out["landuse.json"]
  if (landuse === undefined) {
    throw new Error("mapshaper produced no land use")
  }
  return landuse
}

// All land in the box as one shape. Large water bodies aren't in any
// locality, so the sea, harbour and big rivers stay as gaps. Mapped suburbs
// are simplified exactly like the map, so their coastlines line up.
async function buildSurrounds(mappedIds: string[]) {
  const f = SOURCE.fields
  const out = await geo.applyCommands(
    [
      `-i "${cacheDir}${SOURCE.sal}"`,
      `-clip bbox=${SURROUNDS_BBOX.join(",")}`,
      `-each 'mapped = ${JSON.stringify(mappedIds)}.includes(${f.salCode})'`,
      `-simplify visvalingam weighted variable interval='mapped ? ${SIMPLIFY_METRES} : ${SURROUNDS_SIMPLIFY_METRES}' keep-shapes`,
      "-dissolve",
      "-o surrounds.json format=geojson precision=0.00001",
    ].join(" "),
  )
  const surrounds = out["surrounds.json"]
  if (surrounds === undefined) {
    throw new Error("mapshaper produced no surrounds")
  }
  return surrounds
}

// Label point: the pole of inaccessibility of the largest polygon, so the
// name sits well inside odd shapes. Longitude is scaled by cos(latitude) to
// approximate equal-area space at Sydney's latitude.
const LON_SCALE = Math.cos((-33.8 * Math.PI) / 180)

function ringArea(points: Ring | undefined) {
  let area = 0
  let prev = points?.at(-1)
  for (const p of points ?? []) {
    if (prev) {
      area += (prev[0] - p[0]) * (prev[1] + p[1])
    }
    prev = p
  }
  return Math.abs(area / 2)
}

function round(n: number) {
  return Math.round(n * 1e5) / 1e5
}

function labelPoint(geometry: Geometry) {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates
  let largest: Ring[] = []
  for (const rings of polygons) {
    const scaled = rings.map((r) =>
      r.map(([x, y]): [number, number] => [x * LON_SCALE, y]),
    )
    if (ringArea(scaled[0]) > ringArea(largest[0])) {
      largest = scaled
    }
  }
  const [x, y] = polylabel(largest, 0.00005)
  return { lx: round(x / LON_SCALE), ly: round(y) }
}

async function writeTopoJson(
  suburbsJson: string,
  surroundsJson: string,
  landuseJson: string,
) {
  const out = await geo.applyCommands(
    "-i suburbs.json surrounds.json landuse.json combine-files -rename-layers suburbs,surrounds,landuse -o out.json format=topojson quantization=1000000",
    {
      "suburbs.json": suburbsJson,
      "surrounds.json": surroundsJson,
      "landuse.json": landuseJson,
    },
  )
  const topo = out["out.json"]
  if (topo === undefined) {
    throw new Error("mapshaper produced no TopoJSON")
  }
  await writeFile(topoPath, topo)
  return gzipSync(topo).length
}

function quote(s: string) {
  return `'${s.replaceAll("'", "''")}'`
}

function seedSql(suburbs: Suburb[]) {
  const rows = suburbs
    .toSorted((a, b) => a.id.localeCompare(b.id))
    .map((s) => `(${quote(s.id)}, ${quote(s.name)}, ${quote(s.lga)})`)
  // Each seed is the full list, so suburbs dropped since the last one go too.
  const ids = suburbs.map((s) => quote(s.id)).toSorted()
  const statements = [
    `DELETE FROM suburbs WHERE id NOT IN (${ids.join(", ")});`,
  ]
  for (let i = 0; i < rows.length; i += SEED_CHUNK) {
    statements.push(
      `INSERT INTO suburbs (id, name, lga) VALUES\n${rows.slice(i, i + SEED_CHUNK).join(",\n")}\nON CONFLICT(id) DO UPDATE SET name = excluded.name, lga = excluded.lga;`,
    )
  }
  return [
    "-- Generated by scripts/build-suburbs.ts. Do not edit.",
    ...statements,
  ].join("\n--> statement-breakpoint\n")
}

async function seedMigrations() {
  const files = await readdir(migrationsDir)
  return files.filter((f) => f.endsWith("_seed_suburbs.sql")).toSorted()
}

// Reuses the newest seed migration if the data is unchanged; otherwise asks
// drizzle-kit for a new custom migration so the journal stays in sync.
async function writeSeedMigration(sql: string) {
  const before = await seedMigrations()
  const latest = before.at(-1)
  if (latest && (await readFile(migrationsDir + latest, "utf-8")) === sql) {
    return `${latest} (unchanged)`
  }
  execSync("pnpm exec drizzle-kit generate --custom --name seed_suburbs", {
    cwd: root,
    stdio: "ignore",
  })
  const after = await seedMigrations()
  const created = after.at(-1)
  if (!created || created === latest) {
    throw new Error("drizzle-kit did not create a seed migration")
  }
  await writeFile(migrationsDir + created, sql)
  return created
}

function check(suburbs: Suburb[], gzipBytes: number) {
  const problems: string[] = []
  if (suburbs.length < MIN_SUBURBS || suburbs.length > MAX_SUBURBS) {
    problems.push(
      `suburb count ${suburbs.length} is outside the expected range`,
    )
  }
  if (new Set(suburbs.map((s) => s.id)).size !== suburbs.length) {
    problems.push("duplicate suburb ids")
  }
  if (gzipBytes > MAX_GZIP_BYTES) {
    problems.push(`TopoJSON is ${gzipBytes} bytes gzipped, over budget`)
  }
  if (problems.length > 0) {
    throw new Error(`Sanity checks failed:\n- ${problems.join("\n- ")}`)
  }
}

await mkdir(cacheDir, { recursive: true })
await Promise.all(
  [SOURCE.sal, SOURCE.gccsa, SOURCE.lga, SOURCE.mb].map(download),
)

const collection = await buildGeoJson()
const surrounds = await buildSurrounds(
  collection.features.map((f) => f.properties.id),
)
const features = collection.features.map((f) => ({
  ...f,
  properties: { ...f.properties, ...labelPoint(f.geometry) },
}))
const suburbs = features.map((f) => f.properties)

const suburbsJson = JSON.stringify({ ...collection, features })
const gzipBytes = await writeTopoJson(
  suburbsJson,
  surrounds,
  await buildLanduse(suburbsJson),
)
check(suburbs, gzipBytes)
const migration = await writeSeedMigration(seedSql(suburbs))

console.log(
  [
    `Suburbs: ${suburbs.length}`,
    `TopoJSON: ${(gzipBytes / 1024).toFixed(0)} KB gzipped`,
    `Seed migration: ${migration}`,
  ].join("\n"),
)
