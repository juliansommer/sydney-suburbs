// Tree canopy cover for each mapped suburb, from the NSW urban tree canopy
// spreadsheet. Only cells the sheet needs are read, so no xlsx library.

import { readFile } from "node:fs/promises"

import { unzipSync } from "fflate"

import { download } from "../download.ts"
import { CANOPY } from "../source.ts"

// The canopy only covers the urban part of a suburb, so suburbs mostly
// outside it get no figure rather than one for a sliver.
export const MIN_URBAN_SHARE = 0.2
const HA_PER_KM2 = 100
const PERCENT = 100
const ONE_DECIMAL = 10

const ENTITIES = new Map([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&apos;", "'"],
])

function decode(text: string): string {
  return text.replaceAll(
    /&(?:amp|lt|gt|quot|apos);/gu,
    (e) => ENTITIES.get(e) ?? e,
  )
}

// Rich text splits a string over several <t> elements, so they're joined.
export function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>(?<si>.*?)<\/si>/gsu)].map((item) =>
    [...(item.groups?.si ?? "").matchAll(/<t[^>]*>(?<t>.*?)<\/t>/gsu)]
      .map((run) => decode(run.groups?.t ?? ""))
      .join(""),
  )
}

// Each row as a map from column letter to cell text, with shared strings
// looked up.
export function parseSheet(
  xml: string,
  strings: readonly string[],
): Map<string, string>[] {
  return [...xml.matchAll(/<row[^>]*>(?<row>.*?)<\/row>/gsu)].map((match) => {
    const cells = new Map<string, string>()

    for (const cell of (match.groups?.row ?? "").matchAll(
      /<c r="(?<column>[A-Z]+)\d+"(?<attrs>[^>]*)>(?:<f>.*?<\/f>)?<v>(?<value>.*?)<\/v><\/c>/gsu,
    )) {
      const { column, attrs, value } = cell.groups ?? {}

      if (column && value !== undefined) {
        const shared = attrs?.includes('t="s"')
        cells.set(column, shared ? (strings[Number(value)] ?? "") : value)
      }
    }

    return cells
  })
}

export interface CanopyRow {
  // Hectares of the suburb inside the urban area.
  areaHa: number
  // Share of that area under canopy, from 0 to 1.
  canopy: number
}

// Rows below the header, keyed by the uppercase suburb name.
export function canopyRows(
  rows: Map<string, string>[],
): Map<string, CanopyRow> {
  const { suburb, areaHa, canopy } = CANOPY.columns
  const headerAt = rows.findIndex((r) => [...r.values()].includes(suburb))
  const header = rows[headerAt]

  if (!header) {
    throw new Error(`No "${suburb}" header in ${CANOPY.sheet}`)
  }

  const columnOf = (name: string): string => {
    const found = [...header].find(([, text]) => text === name)?.[0]

    if (!found) {
      throw new Error(`No "${name}" column in ${CANOPY.sheet}`)
    }

    return found
  }

  const columns = {
    suburb: columnOf(suburb),
    areaHa: columnOf(areaHa),
    canopy: columnOf(canopy),
  }

  const parsed = new Map<string, CanopyRow>()

  for (const row of rows.slice(headerAt + 1)) {
    const name = row.get(columns.suburb)
    const area = Number(row.get(columns.areaHa))
    const share = Number(row.get(columns.canopy))

    if (name && Number.isFinite(area) && Number.isFinite(share)) {
      parsed.set(name.toUpperCase(), { areaHa: area, canopy: share })
    }
  }

  return parsed
}

interface CanopySuburb {
  id: string
  name: string
  areaKm2: number
}

// Percent canopy to one decimal place, by suburb id.
export function matchCanopy(
  suburbs: CanopySuburb[],
  rows: ReadonlyMap<string, CanopyRow>,
): Map<string, number> {
  const matched = new Map<string, number>()

  for (const s of suburbs) {
    const row = rows.get(s.name.toUpperCase())

    const mostlyUrban =
      row && row.areaHa >= s.areaKm2 * HA_PER_KM2 * MIN_URBAN_SHARE

    if (row && mostlyUrban) {
      matched.set(
        s.id,
        Math.round(row.canopy * PERCENT * ONE_DECIMAL) / ONE_DECIMAL,
      )
    }
  }

  return matched
}

function readText(files: Record<string, Uint8Array>, name: string): string {
  const file = files[name]

  if (!file) {
    throw new Error(`${name} not found in ${CANOPY.file}`)
  }

  return new TextDecoder().decode(file)
}

// The sheet's file, found through the workbook's relationships.
function sheetPath(files: Record<string, Uint8Array>): string {
  const workbook = readText(files, "xl/workbook.xml")
  const rels = readText(files, "xl/_rels/workbook.xml.rels")

  const sheet = [...workbook.matchAll(/<sheet [^>]*>/gu)]
    .map(([tag]) => tag)
    .find((tag) => decode(tag).includes(`name="${CANOPY.sheet}"`))

  const id = sheet?.match(/r:id="(?<id>[^"]+)"/u)?.groups?.id

  const target = [...rels.matchAll(/<Relationship [^>]*>/gu)]
    .map(([tag]) => tag)
    .find((tag) => tag.includes(`Id="${id}"`))
    ?.match(/Target="(?<target>[^"]+)"/u)?.groups?.target

  if (!id || !target) {
    throw new Error(`No "${CANOPY.sheet}" sheet in ${CANOPY.file}`)
  }

  return `xl/${target}`
}

export async function readCanopy(
  suburbs: CanopySuburb[],
): Promise<Map<string, number>> {
  const path = await download(CANOPY.file, CANOPY.url)
  const files = unzipSync(new Uint8Array(await readFile(path)))
  const strings = parseSharedStrings(readText(files, "xl/sharedStrings.xml"))
  const rows = parseSheet(readText(files, sheetPath(files)), strings)

  return matchCanopy(suburbs, canopyRows(rows))
}
