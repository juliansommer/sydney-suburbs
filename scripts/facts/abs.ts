// Population and postcode for each mapped suburb, from ABS files.

import { readFile } from "node:fs/promises"

import { unzipSync } from "fflate"
import geo from "mapshaper"
import { z } from "zod/mini"

import { absCacheDir, download } from "../download.ts"
import { boundaryUrl, CENSUS, SOURCE } from "../source.ts"

// Census codes carry a prefix our ids don't: "SAL10001" is suburb "10001".
export function stripSalPrefix(code: string): string {
  return code.startsWith(CENSUS.salPrefix)
    ? code.slice(CENSUS.salPrefix.length)
    : code
}

// Total persons by suburb id, from the G01 table. The DataPack is plain
// numeric CSV, so splitting on commas is enough.
export function parsePopulation(csv: string): Map<string, number> {
  const [header = "", ...rows] = csv.trim().split(/\r?\n/)
  const columns = header.split(",")
  const codeIndex = columns.indexOf(CENSUS.fields.salCode)
  const totalIndex = columns.indexOf(CENSUS.fields.totalPersons)
  if (codeIndex === -1 || totalIndex === -1) {
    throw new Error("G01 table is missing its code or total column")
  }
  const population = new Map<string, number>()
  for (const row of rows) {
    const cells = row.split(",")
    const total = Number(cells[totalIndex])
    const code = cells[codeIndex]
    if (code && Number.isInteger(total)) {
      population.set(stripSalPrefix(code), total)
    }
  }
  return population
}

export async function readPopulation(): Promise<Map<string, number>> {
  const path = await download(CENSUS.file, CENSUS.url)
  const files = unzipSync(new Uint8Array(await readFile(path)), {
    filter: (file) => file.name === CENSUS.g01,
  })
  const table = files[CENSUS.g01]
  if (!table) {
    throw new Error(`DataPack has no ${CENSUS.g01}`)
  }
  return parsePopulation(new TextDecoder().decode(table))
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
