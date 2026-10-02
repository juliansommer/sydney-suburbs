// Photo credits from Wikimedia Commons, and which images make good headers.

import { z } from "zod/mini"

import { type CacheOptions, fetchJson } from "../download.ts"
import { chunk, resolveTitles, titleMappings } from "./titles.ts"

const COMMONS_API = "https://commons.wikimedia.org/w/api.php"
// The API takes at most 50 titles per request.
const TITLES_PER_REQUEST = 50
// Downloaded at this width, then resized for the app.
const SOURCE_WIDTH = 1600

export interface PhotoSource {
  file: string
  thumbUrl: string
  artist: string
  licence: string
  licenceUrl: string
  sourceUrl: string
}

const metadataValue = z.optional(z.object({ value: z.string() }))
const imageInfo = z.object({
  query: z.optional(
    z.object({
      ...titleMappings.shape,
      pages: z.array(
        z.object({
          title: z.string(),
          imageinfo: z.optional(
            z.array(
              z.object({
                thumburl: z.string(),
                descriptionurl: z.string(),
                mime: z.string(),
                extmetadata: z.object({
                  Artist: metadataValue,
                  LicenseShortName: metadataValue,
                  LicenseUrl: metadataValue,
                  NonFree: metadataValue,
                }),
              }),
            ),
          ),
        }),
      ),
    }),
  ),
})

// Maps, flags, coats of arms and logos make poor header photos. Words are
// matched between non-letters, since filenames often use underscores.
const UNSUITABLE_NAME =
  /(?<![a-z])(?:maps?|locator|location|flag|coat[ _]of[ _]arms|logo|emblem|crest|diagram|plan)(?![a-z])/i

// Also catches names run together, like "ReservesMap.png".
const JOINED_MAP = /[a-z]Maps?(?![a-z])/

export function isSuitableFile(file: string): boolean {
  return (
    !/\.svg$/i.test(file) &&
    !UNSUITABLE_NAME.test(file) &&
    !JOINED_MAP.test(file)
  )
}

const NAMED_ENTITIES = new Map([
  ["amp", "&"],
  ["lt", "<"],
  ["gt", ">"],
  ["quot", '"'],
  ["apos", "'"],
  ["nbsp", " "],
])
const HEX = 16
const DECIMAL = 10

function decodeEntities(text: string) {
  return text
    .replaceAll(/&#x(?<hex>[\da-f]+);/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, HEX)),
    )
    .replaceAll(/&#(?<decimal>\d+);/g, (_, decimal: string) =>
      String.fromCodePoint(Number.parseInt(decimal, DECIMAL)),
    )
    .replaceAll(
      /&(?<name>\w+);/g,
      (entity, name: string) =>
        NAMED_ENTITIES.get(name.toLowerCase()) ?? entity,
    )
}

// Commons artist fields are HTML, often a link to a user page.
// Wiki signatures add a talk link and a timestamp, which we drop.
const TALK_LINK = /\(\s*talk\s*\)/gi
const SIGNATURE_TIME = /\d{1,2}:\d{2}, \d{1,2} [A-Z][a-z]+ \d{4} \(UTC\)/g

export function cleanArtist(html: string): string {
  return (
    decodeEntities(html.replaceAll(/<[^>]*>/g, " "))
      .replaceAll(TALK_LINK, "")
      .replaceAll(SIGNATURE_TIME, "")
      .replaceAll(/\s+/g, " ")
      // Stripped tags leave spaces inside brackets and before punctuation.
      .replaceAll(/\(\s+/g, "(")
      .replaceAll(/\s+(?<punctuation>[).,])/g, "$<punctuation>")
      .trim()
  )
}

function stripTracking(url: string) {
  const parsed = new URL(url)
  parsed.search = new URLSearchParams(
    [...parsed.searchParams].filter(([key]) => !key.startsWith("utm_")),
  ).toString()
  return parsed.toString()
}

type ImagePage = NonNullable<
  z.infer<typeof imageInfo>["query"]
>["pages"][number]

// A photo we may use: a free licence, a named author and a raster format.
export function toPhotoSource(
  file: string,
  page: ImagePage,
): PhotoSource | null {
  const info = page.imageinfo?.[0]
  const meta = info?.extmetadata
  const licence = meta?.LicenseShortName?.value
  const artist = cleanArtist(meta?.Artist?.value ?? "")
  const nonFree = meta?.NonFree?.value === "true"
  const raster = info?.mime === "image/jpeg" || info?.mime === "image/png"
  if (!info || !licence || !artist || nonFree || !raster) {
    return null
  }
  return {
    file,
    thumbUrl: stripTracking(info.thumburl),
    artist,
    licence: cleanArtist(licence),
    // Public domain files have no licence page, so link the file instead.
    licenceUrl: meta.LicenseUrl?.value ?? info.descriptionurl,
    sourceUrl: info.descriptionurl,
  }
}

// Credits and download URLs for Commons files, keyed by the filename asked
// for. Files that are missing or not freely licensed are left out.
export async function readPhotoSources(
  files: string[],
  options: CacheOptions,
): Promise<Map<string, PhotoSource>> {
  const sources = new Map<string, PhotoSource>()
  for (const batch of chunk(files.toSorted(), TITLES_PER_REQUEST)) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      prop: "imageinfo",
      iiprop: "url|mime|extmetadata",
      iiurlwidth: String(SOURCE_WIDTH),
      iiextmetadatafilter: "Artist|LicenseShortName|LicenseUrl|NonFree",
      titles: batch.map((f) => `File:${f}`).join("|"),
    })
    // Batches run one at a time to keep requests polite.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const { query } = await fetchJson(
      `${COMMONS_API}?${params}`,
      imageInfo,
      options,
    )
    const pages = new Map(query?.pages.map((p) => [p.title, p]))
    for (const file of batch) {
      const title = resolveTitles(`File:${file}`, query)
      const page = pages.get(title)
      const source = page ? toPhotoSource(file, page) : null
      if (source) {
        sources.set(file, source)
      }
    }
  }
  return sources
}
