// Census figures, postcodes and geography for each mapped suburb, from ABS
// files.

import { readFile } from "node:fs/promises"

import { unzipSync } from "fflate"
import geo from "mapshaper"
import { z } from "zod/mini"

import type { TopBirthplace } from "../../src/types/suburb-facts.ts"
import { absCacheDir, download } from "../download.ts"
import { boundaryUrl, CENSUS, SOURCE } from "../source.ts"
import {
  COUNTRY_COLUMNS,
  type CountryColumn,
  topBirthplace,
} from "./birthplace.ts"

// Census codes carry a prefix our ids don't: "SAL10001" is suburb "10001".
export function stripSalPrefix(code: string): string {
  return code.startsWith(CENSUS.salPrefix)
    ? code.slice(CENSUS.salPrefix.length)
    : code
}

const G01_FIELDS = [
  CENSUS.fields.totalPersons,
  CENSUS.fields.bornInAustralia,
  CENSUS.fields.bornElsewhere,
] as const
const G02_FIELDS = [
  CENSUS.fields.medianAge,
  CENSUS.fields.medianRent,
  CENSUS.fields.medianHouseholdIncome,
] as const
const G37_FIELDS = [
  CENSUS.fields.stateHousing,
  CENSUS.fields.tenureNotStated,
  CENSUS.fields.totalDwellings,
] as const

// Every field is present once parseTable has checked the header.
type Row<F extends string> = Partial<Record<F, number>>

// Picks `fields` from a DataPack table, by suburb id. The DataPack is plain
// numeric CSV, so splitting on commas is enough.
export function parseTable<F extends string>(
  csv: string,
  fields: readonly F[],
): Map<string, Row<F>> {
  const [header = "", ...rows] = csv.trim().split(/\r?\n/)
  const columns = header.split(",")
  const missing = [CENSUS.fields.salCode, ...fields].filter(
    (field) => !columns.includes(field),
  )
  if (missing.length > 0) {
    throw new Error(`Census table is missing ${missing.join(", ")}`)
  }
  const codeIndex = columns.indexOf(CENSUS.fields.salCode)
  const table = new Map<string, Row<F>>()
  for (const line of rows) {
    const cells = line.split(",")
    const code = cells[codeIndex]
    const values = fields.map((field) => Number(cells[columns.indexOf(field)]))
    if (code && values.every(Number.isFinite)) {
      const row: Row<F> = {}
      for (const [i, field] of fields.entries()) {
        row[field] = values[i]
      }
      table.set(stripSalPrefix(code), row)
    }
  }
  return table
}

export interface CensusFacts {
  population: number
  medianAge: number | null
  medianRent: number | null
  medianHouseholdIncome: number | null
  // Percent of people who said where they were born, rounded.
  bornOverseas: number | null
  // Percent of occupied private dwellings with a stated tenure that are
  // rented from the state housing authority, to one decimal place.
  publicHousing: number | null
  topBirthplace: TopBirthplace | null
}

const PERCENT = 100
const ONE_DECIMAL = 10

// The ABS reports a median of 0 when too few people answered to give one.
function median(value: number | undefined): number | null {
  return value === undefined || value === 0 ? null : value
}

function publicHousingShare(
  g37: Row<(typeof G37_FIELDS)[number]> | undefined,
): number | null {
  const f = CENSUS.fields
  const stated =
    (g37?.[f.totalDwellings] ?? 0) - (g37?.[f.tenureNotStated] ?? 0)
  if (stated <= 0) {
    return null
  }
  const share = ((g37?.[f.stateHousing] ?? 0) / stated) * PERCENT
  return Math.round(share * ONE_DECIMAL) / ONE_DECIMAL
}

export interface CensusRows {
  g01: Row<(typeof G01_FIELDS)[number]>
  g02?: Row<(typeof G02_FIELDS)[number]>
  g09?: Row<CountryColumn>
  g37?: Row<(typeof G37_FIELDS)[number]>
}

export function toCensusFacts({ g01, g02, g09, g37 }: CensusRows): CensusFacts {
  const f = CENSUS.fields
  const bornElsewhere = g01[f.bornElsewhere] ?? 0
  const stated = (g01[f.bornInAustralia] ?? 0) + bornElsewhere
  const population = g01[f.totalPersons] ?? 0
  return {
    population,
    medianAge: median(g02?.[f.medianAge]),
    medianRent: median(g02?.[f.medianRent]),
    medianHouseholdIncome: median(g02?.[f.medianHouseholdIncome]),
    bornOverseas:
      stated > 0 ? Math.round((bornElsewhere / stated) * PERCENT) : null,
    publicHousing: publicHousingShare(g37),
    topBirthplace: topBirthplace(g09 ?? {}, population),
  }
}

function readEntry(files: Record<string, Uint8Array>, name: string): string {
  const entry = files[name]
  if (!entry) {
    throw new Error(`DataPack has no ${name}`)
  }
  return new TextDecoder().decode(entry)
}

// Country of birth is split across several tables, each with some of the
// countries, so their rows are joined.
function readBirthplaces(
  files: Record<string, Uint8Array>,
): Map<string, Row<CountryColumn>> {
  const joined = new Map<string, Row<CountryColumn>>()
  for (const name of CENSUS.g09) {
    const csv = readEntry(files, name)
    const header = csv.slice(0, csv.indexOf("\n")).trim().split(",")
    const fields = COUNTRY_COLUMNS.filter((c) => header.includes(c))
    for (const [id, row] of parseTable(csv, fields)) {
      joined.set(id, { ...joined.get(id), ...row })
    }
  }
  return joined
}

export async function readCensus(): Promise<Map<string, CensusFacts>> {
  const path = await download(CENSUS.file, CENSUS.url)
  const wanted = new Set<string>([
    CENSUS.g01,
    CENSUS.g02,
    CENSUS.g37,
    ...CENSUS.g09,
  ])
  const files = unzipSync(new Uint8Array(await readFile(path)), {
    filter: (file) => wanted.has(file.name),
  })
  const g01 = parseTable(readEntry(files, CENSUS.g01), G01_FIELDS)
  const g02 = parseTable(readEntry(files, CENSUS.g02), G02_FIELDS)
  const g09 = readBirthplaces(files)
  const g37 = parseTable(readEntry(files, CENSUS.g37), G37_FIELDS)
  return new Map(
    [...g01].map(([id, row]) => [
      id,
      toCensusFacts({
        g01: row,
        g02: g02.get(id),
        g09: g09.get(id),
        g37: g37.get(id),
      }),
    ]),
  )
}

const postcodeRows = z.array(
  z.object({ id: z.string(), postcode: z.nullable(z.string()) }),
)

// Each suburb's postcode is the postal area covering most of it. NSW postal
// areas all start with 2; the 1xxx codes are PO boxes with no boundaries.
export async function readPostcodes(
  ids: string[],
): Promise<Map<string, string>> {
  await Promise.all([
    download(SOURCE.sal, boundaryUrl(SOURCE.sal)),
    download(SOURCE.poa, boundaryUrl(SOURCE.poa)),
  ])
  const f = SOURCE.fields
  const out = await geo.applyCommands(
    [
      `-i "${absCacheDir}${SOURCE.sal}" "${absCacheDir}${SOURCE.poa}" combine-files`,
      `-rename-layers sal,poa`,
      `-filter target=sal '${JSON.stringify(ids)}.includes(${f.salCode})'`,
      `-filter target=poa '${f.poaCode}.startsWith("2")'`,
      `-join target=sal poa largest-overlap fields=${f.poaCode}`,
      `-each 'id = ${f.salCode}, postcode = ${f.poaCode} ?? null'`,
      "-filter-fields id,postcode",
      "-o postcodes.json format=json",
    ].join(" "),
  )
  const rows = postcodeRows.parse(JSON.parse(out["postcodes.json"] ?? "null"))
  const postcodes = new Map<string, string>()
  for (const row of rows) {
    if (row.postcode) {
      postcodes.set(row.id, row.postcode)
    }
  }
  return postcodes
}

const geographyRows = z.array(
  z.object({
    id: z.string(),
    area: z.number(),
  }),
)

export interface Geography {
  areaKm2: number
}

// Each suburb's area in square kilometres.
export async function readGeography(
  ids: string[],
): Promise<Map<string, Geography>> {
  await download(SOURCE.sal, boundaryUrl(SOURCE.sal))
  const f = SOURCE.fields
  const out = await geo.applyCommands(
    [
      `-i "${absCacheDir}${SOURCE.sal}"`,
      `-filter '${JSON.stringify(ids)}.includes(${f.salCode})'`,
      `-each 'id = ${f.salCode}, area = ${f.areaSqKm}'`,
      "-filter-fields id,area",
      "-o geography.json format=json",
    ].join(" "),
  )
  const rows = geographyRows.parse(JSON.parse(out["geography.json"] ?? "null"))
  return new Map(rows.map((row) => [row.id, { areaKm2: row.area }]))
}
