// The committed suburb facts, written by build-suburb-facts.ts and updated by
// build-house-prices.ts. The shape is trusted, as only those scripts write it.

import { existsSync } from "node:fs"
import { readFile } from "node:fs/promises"

import type { SuburbFactsFile } from "../src/types/suburb-facts.ts"
import { root } from "./download.ts"

export const factsPath = `${root}src/data/suburb-facts.json`

export async function readFactsFile(): Promise<SuburbFactsFile> {
  if (!existsSync(factsPath)) {
    return {}
  }

  // oxlint-disable-next-line typescript/no-unsafe-return
  return JSON.parse(await readFile(factsPath, "utf-8"))
}
