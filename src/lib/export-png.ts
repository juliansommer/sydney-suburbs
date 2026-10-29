import geistUrl from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url"

import {
  projectBase,
  type ProjectedSuburb,
  projectLayers,
} from "@/components/map/project"
import type { Bounds } from "@/lib/zoom"
import type { SuburbMapData } from "@/types/suburb"

import { CHAR_WIDTH, labelFits, labelVisible, placeLabels } from "./labels"
import { regionLayers } from "./region-layers"
import type { RegionMap } from "./regions"

// The light theme's map colours, as literals: an SVG drawn as an image can't
// see the page's CSS, and exports look the same whatever the app theme.
export const EXPORT_PALETTE = {
  water: "#d5ecf8",
  land: "#fbfaf6",
  surrounds: "#c6e9c6",
  border: "#bfbeb7",
  label: "#3a3a3a",
  halo: "#ffffff",
  outline: "#252525",
  text: "#171717",
  muted: "#737373",
  background: "#ffffff",
} as const

export const ABS_CREDIT = "Suburb boundaries © ABS, CC BY 4.0"

export type Framing = "regions" | "all"

export interface ExportOptions {
  framing: Framing
  suburbNames: boolean
  // A data: URL of the font, embedded since an SVG image can't fetch one.
  fontUrl?: string
}

// Long edge of the map, and the cap on either edge of the whole image, under
// iOS Safari's canvas limit.
const LONG_EDGE = 2400
const MAX_EDGE = 4096
const FRAME_PADDING = 0.05

// The map is projected at this size, then framed and scaled up.
const BASE_SIZE = 1000

// Text sizes, in image pixels at the full long edge.
const TITLE_SIZE = 56
const REGION_LABEL_SIZE = 40
const SUBURB_LABEL_SIZE = 20
const LEGEND_SIZE = 28
const CREDIT_SIZE = 20
const MARGIN = 48
const SWATCH = 28
const LEGEND_GAP = 40

// The download starts after the click returns, so the PNG's URL outlives it.
const REVOKE_AFTER_MS = 10_000

// Visible fill of a region over the land, like on screen.
const REGION_FILL_MIX = 0.7

const FONT_FAMILY = "Geist, sans-serif"

function escape(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
}

function channel(hex: string, i: number): number {
  return Number.parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16)
}

function mixHex(color: string, base: string, amount: number): string {
  const mixed = [0, 1, 2].map((i) =>
    Math.round(channel(color, i) * amount + channel(base, i) * (1 - amount))
      .toString(16)
      .padStart(2, "0"),
  )

  return `#${mixed.join("")}`
}

function union(boxes: Bounds[]): Bounds | undefined {
  if (boxes.length === 0) {
    return undefined
  }

  return [
    [
      Math.min(...boxes.map((b) => b[0][0])),
      Math.min(...boxes.map((b) => b[0][1])),
    ],
    [
      Math.max(...boxes.map((b) => b[1][0])),
      Math.max(...boxes.map((b) => b[1][1])),
    ],
  ]
}

function pad([[x0, y0], [x1, y1]]: Bounds): Bounds {
  const px = (x1 - x0) * FRAME_PADDING
  const py = (y1 - y0) * FRAME_PADDING

  return [
    [x0 - px, y0 - py],
    [x1 + px, y1 + py],
  ]
}

function frameOf(
  framing: Framing,
  suburbs: ProjectedSuburb[],
  map: RegionMap,
): Bounds {
  const inRegion = new Set(map.regions.flatMap((r) => r.suburbIds))

  const regionBoxes = suburbs.flatMap((s) =>
    inRegion.has(s.id) ? [s.bounds] : [],
  )

  const all = union(suburbs.map((s) => s.bounds)) ?? [
    [0, 0],
    [BASE_SIZE, BASE_SIZE],
  ]

  return pad(framing === "regions" ? (union(regionBoxes) ?? all) : all)
}

function svgText(
  x: number,
  y: number,
  size: number,
  content: string,
  attrs = "",
): string {
  return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${size}" ${attrs}>${escape(content)}</text>`
}

function textWidth(text: string, size: number): number {
  return text.length * CHAR_WIDTH * size
}

interface LegendEntry {
  x: number
  y: number
  color: string
  text: string
}

// Wraps the legend into rows across the image's width.
interface LegendLayout {
  entries: LegendEntry[]
  height: number
}

function layoutLegend(
  map: RegionMap,
  width: number,
  top: number,
): LegendLayout {
  const entries: LegendEntry[] = []
  let x = MARGIN
  let y = top
  const rowHeight = LEGEND_SIZE * 1.6

  for (const region of map.regions) {
    const count = region.suburbIds.length
    const text = `${region.name} (${count} ${count === 1 ? "suburb" : "suburbs"})`
    const entryWidth = SWATCH + 12 + textWidth(text, LEGEND_SIZE)

    if (x > MARGIN && x + entryWidth > width - MARGIN) {
      x = MARGIN
      y += rowHeight
    }

    entries.push({ x, y, color: region.color, text })
    x += entryWidth + LEGEND_GAP
  }

  const height = entries.length > 0 ? y - top + rowHeight : 0

  return { entries, height }
}

export interface ExportSvg {
  svg: string
  width: number
  height: number
}

// A self-contained SVG of the regions: every colour a literal attribute, no
// classes or CSS variables, framed on the regions or on all of Sydney.
export function exportSvg(
  data: SuburbMapData,
  map: RegionMap,
  options: ExportOptions,
): ExportSvg {
  const base = projectBase(data, BASE_SIZE, BASE_SIZE)
  const layers = projectLayers(regionLayers(map, data), base)
  const [[fx0, fy0], [fx1, fy1]] = frameOf(options.framing, base.suburbs, map)
  const frameWidth = fx1 - fx0
  const frameHeight = fy1 - fy0
  const scale = LONG_EDGE / Math.max(frameWidth, frameHeight)
  const width = Math.round(frameWidth * scale)
  const mapHeight = Math.round(frameHeight * scale)
  const header = MARGIN * 2 + TITLE_SIZE
  const legend = layoutLegend(map, width, header + mapHeight + MARGIN)
  const creditTop = header + mapHeight + MARGIN + legend.height

  const height = Math.min(
    MAX_EDGE,
    Math.round(creditTop + CREDIT_SIZE + MARGIN),
  )

  const toImage = ([x, y]: [number, number]): [number, number] => [
    (x - fx0) * scale,
    header + (y - fy0) * scale,
  ]

  const colors = new Map(map.regions.map((r) => [r.id, r.color]))
  const stroke = (px: number) => px / scale

  const regionLabels = placeLabels(
    layers.labels.flatMap((l) => {
      if (!labelFits(l, scale, l.text, REGION_LABEL_SIZE)) {
        return []
      }

      const [x, y] = toImage([l.x, l.y])

      return [{ ...l, name: l.text, x, y }]
    }),
    REGION_LABEL_SIZE,
  )

  const obstacles = regionLabels.map((l) => {
    const half = textWidth(l.text, REGION_LABEL_SIZE) / 2

    return {
      x0: l.x - half,
      y0: l.y - REGION_LABEL_SIZE / 2,
      x1: l.x + half,
      y1: l.y + REGION_LABEL_SIZE / 2,
    }
  })

  const suburbLabels = options.suburbNames
    ? placeLabels(
        base.suburbs.flatMap((s) => {
          if (!s.label || !labelVisible(s, scale, SUBURB_LABEL_SIZE)) {
            return []
          }

          const [x, y] = toImage(s.label)

          const outside =
            x < 0 || x > width || y < header || y > header + mapHeight

          return outside ? [] : [{ ...s, x, y }]
        }),
        SUBURB_LABEL_SIZE,
        obstacles,
      )
    : []

  const landuseColor = {
    parkland: EXPORT_PALETTE.surrounds,
    water: EXPORT_PALETTE.water,
  }

  const halo = (size: number, weight: number) =>
    `fill="${EXPORT_PALETTE.label}" stroke="${EXPORT_PALETTE.halo}" stroke-width="${size / 4}" stroke-linejoin="round" paint-order="stroke" text-anchor="middle" dominant-baseline="central" font-weight="${weight}"`

  const font = options.fontUrl
    ? `<style>@font-face{font-family:Geist;src:url(${options.fontUrl}) format("woff2");font-weight:100 900}</style>`
    : ""

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" font-family="${FONT_FAMILY}">`,
    font,
    `<rect width="${width}" height="${height}" fill="${EXPORT_PALETTE.background}"/>`,
    svgText(
      MARGIN,
      MARGIN + TITLE_SIZE * 0.8,
      TITLE_SIZE,
      map.title,
      `fill="${EXPORT_PALETTE.text}" font-weight="700"`,
    ),
    `<svg x="0" y="${header}" width="${width}" height="${mapHeight}" viewBox="${fx0} ${fy0} ${frameWidth} ${frameHeight}">`,
    `<rect x="${fx0}" y="${fy0}" width="${frameWidth}" height="${frameHeight}" fill="${EXPORT_PALETTE.water}"/>`,
    `<path d="${base.surrounds}" fill="${EXPORT_PALETTE.surrounds}"/>`,
    `<path d="${base.land}" fill="${EXPORT_PALETTE.land}"/>`,
    ...base.landuse.map(
      (l) => `<path d="${l.d}" fill="${landuseColor[l.kind]}"/>`,
    ),
    ...layers.fills.map((f) => {
      const color = colors.get(f.key) ?? EXPORT_PALETTE.land

      return `<path d="${f.d}" fill="${mixHex(color, EXPORT_PALETTE.land, REGION_FILL_MIX)}"/>`
    }),
    `<path d="${base.suburbs.map((s) => s.d).join("")}" fill="none" stroke="${EXPORT_PALETTE.border}" stroke-width="${stroke(1)}" stroke-linejoin="round"/>`,
    ...layers.outlines.map(
      (o) =>
        `<path d="${o.d}" fill="none" stroke="${EXPORT_PALETTE.outline}" stroke-width="${stroke(3)}" stroke-linejoin="round"/>`,
    ),
    "</svg>",
    `<g ${halo(SUBURB_LABEL_SIZE, 400)}>`,
    ...suburbLabels.map((l) => svgText(l.x, l.y, SUBURB_LABEL_SIZE, l.name)),
    "</g>",
    `<g ${halo(REGION_LABEL_SIZE, 600)}>`,
    ...regionLabels.map((l) => svgText(l.x, l.y, REGION_LABEL_SIZE, l.text)),
    "</g>",
    ...legend.entries.flatMap((e) => [
      `<rect x="${e.x}" y="${e.y}" width="${SWATCH}" height="${SWATCH}" rx="4" fill="${mixHex(e.color, EXPORT_PALETTE.land, REGION_FILL_MIX)}" stroke="${EXPORT_PALETTE.outline}" stroke-width="1"/>`,
      svgText(
        e.x + SWATCH + 12,
        e.y + SWATCH / 2,
        LEGEND_SIZE,
        e.text,
        `fill="${EXPORT_PALETTE.text}" dominant-baseline="central"`,
      ),
    ]),
    svgText(
      MARGIN,
      creditTop + CREDIT_SIZE,
      CREDIT_SIZE,
      ABS_CREDIT,
      `fill="${EXPORT_PALETTE.muted}"`,
    ),
    "</svg>",
  ]

  return { svg: parts.join(""), width, height }
}

let fontDataUrl: Promise<string> | undefined

// Spread into String.fromCodePoint in chunks, under the argument limit.
const BASE64_CHUNK = 0x80_00

function toBase64(bytes: Uint8Array): string {
  let binary = ""

  for (let i = 0; i < bytes.length; i += BASE64_CHUNK) {
    binary += String.fromCodePoint(...bytes.subarray(i, i + BASE64_CHUNK))
  }

  return btoa(binary)
}

// Fetched once, then reused by every export.
async function loadFont(): Promise<string> {
  fontDataUrl ??= (async () => {
    const res = await fetch(geistUrl)

    if (!res.ok) {
      throw new Error(`Font failed to load (${res.status})`)
    }

    const bytes = new Uint8Array(await res.arrayBuffer())

    return `data:font/woff2;base64,${toBase64(bytes)}`
  })()

  try {
    return await fontDataUrl
  } catch (error) {
    fontDataUrl = undefined
    throw error
  }
}

export function exportFileName(title: string): string {
  const slug = title
    .toLowerCase()
    .replaceAll(/[^\da-z]+/g, "-")
    .replaceAll(/^-|-$/g, "")

  if (!slug) {
    return "sydney-regions.png"
  }

  return slug.endsWith("regions") ? `${slug}.png` : `${slug}-regions.png`
}

async function toPng(canvas: HTMLCanvasElement): Promise<Blob> {
  // oxlint-disable-next-line promise/avoid-new
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error("The image is too big to export"))
      }
    }, "image/png")
  })
}

// SVG string, to an image, onto a canvas, out as a PNG download. blob: URLs
// skip URL-encoding several MB of paths and any data: URL size limits.
export async function downloadPng(
  data: SuburbMapData,
  map: RegionMap,
  options: Omit<ExportOptions, "fontUrl">,
): Promise<void> {
  // A missing font falls back to the system's sans-serif.
  const fontUrl = await loadFont().catch(() => undefined)
  const { svg, width, height } = exportSvg(data, map, { ...options, fontUrl })
  const svgUrl = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }))
  let pngUrl: string | undefined

  try {
    const image = new Image(width, height)
    image.src = svgUrl
    await image.decode()

    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext("2d")

    if (!context) {
      throw new Error("The image is too big to export")
    }

    context.drawImage(image, 0, 0, width, height)
    pngUrl = URL.createObjectURL(await toPng(canvas))

    const link = document.createElement("a")
    link.href = pngUrl
    link.download = exportFileName(map.title)
    link.click()
  } finally {
    URL.revokeObjectURL(svgUrl)

    if (pngUrl) {
      const url = pngUrl
      setTimeout(() => {
        URL.revokeObjectURL(url)
      }, REVOKE_AFTER_MS)
    }
  }
}
