// Draws the birthplace flags as WebP bitmaps into src/data/flags. Run by hand
// with `pnpm build:flags` after adding a country; outputs are committed.
//
// Source: flag-icons, licensed MIT.

import { mkdir, readdir, rm } from "node:fs/promises"

import sharp from "sharp"

import { root } from "./download.ts"

// Chrome re-draws an SVG pattern fill for every suburb on every frame of a pan
// or zoom, so the map gets bitmaps. 4:3, like the flag-icons sources.
const SIZE = { width: 400, height: 300 } as const
// Near-lossless keeps the flat colours and sharp edges clean, at a smaller
// size than lossy WebP that looks as good.
const QUALITY = 60

// Country key in src/data/birthplace-countries.ts to flag-icons code.
const FLAGS = {
  bangladesh: "bd",
  china: "cn",
  england: "gb-eng",
  fiji: "fj",
  greece: "gr",
  india: "in",
  indonesia: "id",
  iraq: "iq",
  italy: "it",
  lebanon: "lb",
  malta: "mt",
  nepal: "np",
  "new-zealand": "nz",
  "north-macedonia": "mk",
  philippines: "ph",
  "south-africa": "za",
  "south-korea": "kr",
  vietnam: "vn",
} as const satisfies Record<string, string>

const sourceDir = `${root}node_modules/flag-icons/flags/4x3/`
const outDir = `${root}src/data/flags/`

await mkdir(outDir, { recursive: true })
// Drops flags for countries no longer listed.
const stale = await readdir(outDir)
await Promise.all(
  stale.map(async (file) => {
    await rm(`${outDir}${file}`)
  }),
)
await Promise.all(
  Object.entries(FLAGS).map(async ([key, code]) => {
    // A high density renders the SVG sharp before it's scaled down.
    await sharp(`${sourceDir}${code}.svg`, { density: 300 })
      .resize(SIZE.width, SIZE.height, { fit: "fill" })
      .webp({ nearLossless: true, quality: QUALITY })
      .toFile(`${outDir}${key}.webp`)
  }),
)
console.log(`Wrote ${Object.keys(FLAGS).length} flags to src/data/flags`)
