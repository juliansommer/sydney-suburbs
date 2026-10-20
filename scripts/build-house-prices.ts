// Updates each suburb's median house price in the suburb facts. Run by hand
// with `pnpm build:house-prices` after downloading new sales files; the
// outputs are committed.
//
// Source: NSW Valuer General bulk Property Sales Information, licensed
//   CC BY-NC-ND 4.0. Download the yearly and weekly zips from the bulk PSI page
//   into .cache/psi/, since Cloudflare blocks scripted downloads.

import { writeFile } from "node:fs/promises"

import { root } from "./download.ts"
import { factsPath, readFactsFile } from "./facts-file.ts"
import {
  isHouseSale,
  medianPrices,
  missingWeeks,
  periodFor,
  readSalesFiles,
  uniqueSales,
} from "./facts/psi.ts"
import { readMapSuburbs } from "./map-suburbs.ts"
import { PSI } from "./source.ts"

const periodPath = `${root}src/data/house-price-period.json`

const UNMATCHED_SHOWN = 20

const { sales, fileDays } = await readSalesFiles(`${root}${PSI.dir}`)
const period = periodFor(fileDays)

if (!period) {
  throw new Error(
    `No sales files in ${PSI.dir}; download them from ${PSI.page}`,
  )
}

const gaps = missingWeeks(fileDays, period)

if (gaps.length > 0) {
  throw new Error(
    `Sales files for ${period.from} to ${period.to} are missing weeks:\n  ${gaps.join("\n  ")}`,
  )
}

const unique = uniqueSales(sales)
const prices = medianPrices(unique, period)
const suburbs = await readMapSuburbs()

const facts = await readFactsFile()

const matched = new Set<string>()

for (const s of suburbs) {
  const stats = facts[s.id]?.stats
  const price = prices.get(s.name.toLowerCase())

  if (stats) {
    stats.medianHousePrice = price?.median ?? null
    stats.landPricePerM2 = price?.medianPerM2 ?? null
  }

  if (price) {
    matched.add(s.name.toLowerCase())
  }
}

await writeFile(factsPath, JSON.stringify(facts))

await writeFile(periodPath, `${JSON.stringify(period, null, 2)}\n`)

console.log(`Period: ${period.from} to ${period.to}`)

console.log(`Sale records: ${sales.length}, unique: ${unique.length}`)

console.log(`House sales: ${unique.filter(isHouseSale).length}`)

console.log(`Suburbs with a median: ${matched.size} of ${suburbs.length}`)

const missing = suburbs.filter((s) => !matched.has(s.name.toLowerCase()))

console.log(`\nNo median (${missing.length}):`)

for (const s of missing) {
  console.log(`  ${s.id} ${s.name}`)
}

// Localities with enough sales but no map suburb, busiest first, to catch
// names spelled differently. Most are simply outside the map.
const unmatched = [...prices]
  .filter(([locality]) => !matched.has(locality))
  .toSorted(([, a], [, b]) => b.sales - a.sales)
  .slice(0, UNMATCHED_SHOWN)

console.log(`\nBusiest unmatched localities:`)

for (const [locality, price] of unmatched) {
  console.log(`  ${locality}: ${price.sales} sales`)
}
