// Median house prices for each mapped suburb, from the NSW Valuer General's
// bulk Property Sales Information (PSI).

import { readdir, readFile } from "node:fs/promises"

import { unzipSync } from "fflate"

// Field positions in a "B" (sale) record, from the Valuer General's "Current
// Property Sales Data File (Format 2001 - current)" fact sheet.
const FIELD = {
  type: 0,
  district: 1,
  propertyId: 2,
  downloaded: 4,
  locality: 9,
  postcode: 10,
  settlementDate: 14,
  price: 15,
  nature: 17,
  strataLot: 19,
  interest: 22,
  dealing: 23,
} as const

const RESIDENCE = "R"

// The fact sheet says a whole sale leaves % interest empty, but files before
// mid-2025 write 0 instead.
const WHOLE_INTEREST: ReadonlySet<string> = new Set(["", "0"])

// Below this a "residence" is a transfer between family members, or a lot in
// a new estate before its house is built. No Sydney house sells this low.
export const MIN_PRICE = 300_000

// Below this a single sale moves the median too far to compare.
export const MIN_SALES = 5

const PERIOD_MONTHS = 12

// The latest file's month counts as covered if the file is this close to
// its end, as each file holds the week before it was written.
const MONTH_END_DAYS = 7

const ROUND_TO = 1000

// Weekly files come out every 7 days; a longer gap means one wasn't
// downloaded.
const MAX_GAP_DAYS = 10
const MS_PER_DAY = 86_400_000

export interface Sale {
  district: string
  propertyId: string
  dealing: string
  // CCYYMMDD HH24:MI, when the Valuer General wrote the file.
  downloaded: string
  locality: string
  postcode: string
  // CCYYMMDD.
  settlementDate: string
  price: number
  nature: string
  strataLot: string
  interest: string
}

// A "B" record as a sale, or null for any other record.
export function parseSale(line: string): Sale | null {
  const f = line.split(";")

  if (f[FIELD.type] !== "B") {
    return null
  }

  const field = (i: number) => f[i]?.trim() ?? ""

  return {
    district: field(FIELD.district),
    propertyId: field(FIELD.propertyId),
    dealing: field(FIELD.dealing),
    downloaded: field(FIELD.downloaded),
    locality: field(FIELD.locality),
    postcode: field(FIELD.postcode),
    settlementDate: field(FIELD.settlementDate),
    price: Number(field(FIELD.price)),
    nature: field(FIELD.nature),
    strataLot: field(FIELD.strataLot),
    interest: field(FIELD.interest),
  }
}

// A whole house, not a unit, vacant land or part share, at a real price.
export function isHouseSale(sale: Sale): boolean {
  return (
    sale.nature === RESIDENCE &&
    sale.strataLot === "" &&
    WHOLE_INTEREST.has(sale.interest) &&
    sale.price >= MIN_PRICE
  )
}

// Each sale once, at its latest copy, without dealings that cover several
// properties, whose price is the total for all of them.
export function uniqueSales(sales: Iterable<Sale>): Sale[] {
  const latest = new Map<string, Sale>()

  for (const sale of sales) {
    const key = `${sale.district}|${sale.propertyId}|${sale.dealing}`
    const seen = latest.get(key)

    if (!seen || sale.downloaded > seen.downloaded) {
      latest.set(key, sale)
    }
  }

  const properties = new Map<string, Set<string>>()

  for (const sale of latest.values()) {
    const ids = properties.get(sale.dealing) ?? new Set()
    properties.set(sale.dealing, ids.add(`${sale.district}|${sale.propertyId}`))
  }

  return [...latest.values()].filter(
    (sale) => (properties.get(sale.dealing)?.size ?? 0) === 1,
  )
}

export interface Period {
  // First and last month of settlement dates, as YYYY-MM.
  from: string
  to: string
}

function dayOf(yyyymmdd: string): number {
  return Date.UTC(
    Number(yyyymmdd.slice(0, 4)),
    Number(yyyymmdd.slice(4, 6)) - 1,
    Number(yyyymmdd.slice(6, 8)),
  )
}

function monthOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, "YYYY-MM".length)
}

function monthStart(month: string): number {
  return dayOf(`${month.replace("-", "")}01`)
}

// The first day of the month after `month`.
function nextMonthStart(month: string): number {
  const start = new Date(monthStart(month))

  return Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)
}

// The 12 whole months ending with the last month the files cover, or null if
// there are no files.
export function periodFor(fileDays: Iterable<string>): Period | null {
  const latest = Math.max(...[...fileDays].map(dayOf))

  if (!Number.isFinite(latest)) {
    return null
  }

  const month = monthOf(latest)

  const covered = nextMonthStart(month) - latest <= MONTH_END_DAYS * MS_PER_DAY

  const last = new Date(monthStart(month))
  const lastMonth = covered ? 0 : 1

  return {
    from: monthOf(
      Date.UTC(
        last.getUTCFullYear(),
        last.getUTCMonth() - lastMonth - (PERIOD_MONTHS - 1),
        1,
      ),
    ),
    to: monthOf(
      Date.UTC(last.getUTCFullYear(), last.getUTCMonth() - lastMonth, 1),
    ),
  }
}

function inPeriod(settlementDate: string, { from, to }: Period): boolean {
  const month = `${settlementDate.slice(0, 4)}-${settlementDate.slice(4, 6)}`

  return month >= from && month <= to
}

export interface LocalityPrice {
  median: number
  sales: number
}

function median(sorted: number[]): number {
  const mid = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 1
    ? (sorted[mid] ?? 0)
    : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2
}

// Median house price by lower-cased locality, over house sales settled in
// the period. Localities with too few sales are left out.
export function medianPrices(
  sales: Iterable<Sale>,
  period: Period,
): Map<string, LocalityPrice> {
  const prices = new Map<string, number[]>()

  for (const sale of sales) {
    if (isHouseSale(sale) && inPeriod(sale.settlementDate, period)) {
      const key = sale.locality.toLowerCase()
      prices.set(key, [...(prices.get(key) ?? []), sale.price])
    }
  }

  const medians = new Map<string, LocalityPrice>()

  for (const [locality, list] of prices) {
    if (list.length >= MIN_SALES) {
      const sorted = list.toSorted((a, b) => a - b)
      medians.set(locality, {
        median: Math.round(median(sorted) / ROUND_TO) * ROUND_TO,
        sales: list.length,
      })
    }
  }

  return medians
}

function isoDay(ms: number): string {
  return new Date(ms).toISOString().slice(0, "YYYY-MM-DD".length)
}

// Stretches of the period with no file. `fileDays` are the days the files
// were written, as CCYYMMDD.
export function missingWeeks(
  fileDays: Iterable<string>,
  period: Period,
): string[] {
  const start = monthStart(period.from)
  const end = nextMonthStart(period.to)

  const days: number[] = []

  for (const fileDay of new Set(fileDays)) {
    const day = dayOf(fileDay)

    if (day > start && day < end) {
      days.push(day)
    }
  }

  days.sort((a, b) => a - b)

  const edges = [start, ...days, end]
  const gaps: string[] = []

  for (let i = 1; i < edges.length; i++) {
    const from = edges[i - 1] ?? 0
    const to = edges[i] ?? 0

    if (to - from > MAX_GAP_DAYS * MS_PER_DAY) {
      gaps.push(`${isoDay(from)} to ${isoDay(to)}`)
    }
  }

  return gaps
}

export interface SalesFiles {
  sales: Sale[]
  // The days the files were written, from their "A" header records.
  fileDays: Set<string>
}

function readDat(text: string, into: SalesFiles) {
  for (const line of text.split(/\r?\n/)) {
    if (line.startsWith("A;")) {
      const written = line.split(";")[3]?.trim() ?? ""
      into.fileDays.add(written.slice(0, "CCYYMMDD".length))
    } else {
      const sale = parseSale(line)

      if (sale) {
        into.sales.push(sale)
      }
    }
  }
}

// Yearly zips hold the year's weekly zips, so zips are opened recursively.
function readZip(data: Uint8Array, into: SalesFiles) {
  const decoder = new TextDecoder("latin1")

  for (const [name, content] of Object.entries(unzipSync(data))) {
    const lower = name.toLowerCase()

    if (lower.endsWith(".zip")) {
      readZip(content, into)
    } else if (lower.endsWith(".dat")) {
      readDat(decoder.decode(content), into)
    }
  }
}

// Every sale in the zips in `dir`, as downloaded from the bulk PSI page.
export async function readSalesFiles(dir: string): Promise<SalesFiles> {
  const files = await readdir(dir).catch(() => [])
  const zips = files.filter((f) => f.toLowerCase().endsWith(".zip"))
  const into: SalesFiles = { sales: [], fileDays: new Set() }

  for (const zip of zips) {
    // oxlint-disable-next-line eslint/no-await-in-loop
    readZip(new Uint8Array(await readFile(`${dir}${zip}`)), into)
  }

  return into
}
