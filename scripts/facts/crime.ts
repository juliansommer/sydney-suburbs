// Violent crime rates for each mapped suburb, from BOCSAR's recorded crime
// by suburb.

import { createReadStream } from "node:fs"

import { Unzip, UnzipInflate } from "fflate"

import { download } from "../download.ts"
import { BOCSAR } from "../source.ts"

// BOCSAR offence categories counted as violent.
export const VIOLENT_CATEGORIES: ReadonlySet<string> = new Set([
  "Homicide",
  "Assault",
  "Sexual offences",
  "Robbery",
  "Abduction and kidnapping",
])
const RECENT_MONTHS = 12
const PER_PEOPLE = 100_000
// Below this a single incident swings the rate too far to compare.
export const MIN_POPULATION = 500

// Every cell is quoted, and subcategories can hold commas, so rows split on
// the quotes between cells rather than on bare commas.
export function splitRow(line: string): string[] {
  return line.trim().slice(1, -1).split('","')
}

// Violent incidents over the latest months in the file, by BOCSAR suburb
// name. `header` is the CSV's first line.
export function tallyViolent(
  header: string,
  lines: Iterable<string>,
): Map<string, number> {
  const width = splitRow(header).length
  const tallies = new Map<string, number>()
  for (const line of lines) {
    const [suburb, category, , ...months] = splitRow(line)
    if (suburb && category && VIOLENT_CATEGORIES.has(category)) {
      const recent = months
        .slice(width - 3 - RECENT_MONTHS)
        .reduce((sum, cell) => sum + (Number(cell) || 0), 0)
      tallies.set(suburb, (tallies.get(suburb) ?? 0) + recent)
    }
  }
  return tallies
}

interface CrimeSuburb {
  id: string
  name: string
  lga: string
}

// BOCSAR adds the council to names shared across NSW, like "Punchbowl
// (Canterbury-Bankstown)", so that form is tried first.
export function matchSuburbs(
  suburbs: CrimeSuburb[],
  tallies: ReadonlyMap<string, number>,
): Map<string, number> {
  const matched = new Map<string, number>()
  for (const s of suburbs) {
    const incidents = tallies.get(`${s.name} (${s.lga})`) ?? tallies.get(s.name)
    if (incidents !== undefined) {
      matched.set(s.id, incidents)
    }
  }
  return matched
}

// Yearly incidents per 100,000 residents, rounded.
export function crimeRate(
  incidents: number | undefined,
  population: number | null | undefined,
): number | null {
  if (incidents === undefined || !population || population < MIN_POPULATION) {
    return null
  }
  return Math.round((incidents / population) * PER_PEOPLE)
}

// The CSV is too big to hold as one string, so it streams out of the zip and
// only the header and violent rows are kept.
async function readViolentRows(
  path: string,
): Promise<{ header: string; rows: string[] }> {
  const decoder = new TextDecoder()
  const rows: string[] = []
  let header = ""
  let partial = ""
  function addLine(line: string) {
    if (!header) {
      header = line
    } else if (VIOLENT_CATEGORIES.has(splitRow(line)[1] ?? "")) {
      rows.push(line)
    }
  }
  const unzip = new Unzip((file) => {
    if (file.name !== BOCSAR.csv) {
      return
    }
    file.ondata = (error, chunk, final) => {
      if (error) {
        throw error
      }
      const lines = (partial + decoder.decode(chunk, { stream: !final })).split(
        /\r?\n/,
      )
      partial = final ? "" : (lines.pop() ?? "")
      for (const line of lines.filter(Boolean)) {
        addLine(line)
      }
    }
    file.start()
  })
  unzip.register(UnzipInflate)
  for await (const chunk of createReadStream(path)) {
    if (chunk instanceof Uint8Array) {
      unzip.push(chunk)
    }
  }
  unzip.push(new Uint8Array(0), true)
  if (!header) {
    throw new Error(`${BOCSAR.file} has no ${BOCSAR.csv}`)
  }
  return { header, rows }
}

// Violent incidents over the latest 12 months, by suburb id. Suburbs BOCSAR
// doesn't list are left out.
export async function readViolentCrime(
  suburbs: CrimeSuburb[],
): Promise<Map<string, number>> {
  const path = await download(BOCSAR.file, BOCSAR.url)
  const { header, rows } = await readViolentRows(path)
  return matchSuburbs(suburbs, tallyViolent(header, rows))
}
