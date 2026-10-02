// Matches each suburb to its English Wikipedia article and Wikidata image.

import { readFile } from "node:fs/promises"

import { z } from "zod/mini"

import { type CacheOptions, fetchJson, root } from "../download.ts"
import { chunk, resolveTitles, titleMappings } from "./titles.ts"

const SPARQL_URL = "https://query.wikidata.org/sparql"
const WIKIPEDIA_API = "https://en.wikipedia.org/w/api.php"
const ARTICLE_PREFIX = "https://en.wikipedia.org/wiki/"
const FILE_PATH_PREFIX = "http://commons.wikimedia.org/wiki/Special:FilePath/"
const NEW_SOUTH_WALES = "Q3224"
const overridesPath = `${root}scripts/wikipedia-overrides.json`

// Walking P131* up to NSW for every item times out, so the query relies on
// the SAL code alone. Codes starting SAL1 are all in NSW.
const SUBURBS_QUERY = `
SELECT ?sal (SAMPLE(?a) AS ?article) (SAMPLE(?img) AS ?image) WHERE {
  ?item wdt:P10112 ?sal .
  FILTER(STRSTARTS(?sal, "SAL1"))
  OPTIONAL { ?a schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> }
  OPTIONAL { ?item wdt:P18 ?img }
}
GROUP BY ?sal`

export interface WikiMatch {
  title: string | null
  // Commons filename, without the "File:" prefix.
  image: string | null
}

const binding = z.optional(z.object({ value: z.string() }))
const sparqlResults = z.object({
  results: z.object({
    bindings: z.array(
      z.object({
        sal: z.object({ value: z.string() }),
        article: binding,
        image: binding,
      }),
    ),
  }),
})

const askResult = z.object({ boolean: z.boolean() })

const pageProps = z.object({
  query: z.optional(
    z.object({
      pages: z.array(
        z.object({
          title: z.string(),
          missing: z.optional(z.boolean()),
          pageprops: z.optional(
            z.object({
              wikibase_item: z.optional(z.string()),
              disambiguation: z.optional(z.string()),
            }),
          ),
        }),
      ),
    }),
  ),
})

// A SAL code maps to replacement values; `null` means there is none.
const overrideSchema = z.record(
  z.string(),
  z.object({
    title: z.optional(z.nullable(z.string())),
    image: z.optional(z.nullable(z.string())),
  }),
)
export type Overrides = z.infer<typeof overrideSchema>

export function titleFromUrl(url: string): string {
  return decodeURIComponent(url.slice(ARTICLE_PREFIX.length)).replaceAll(
    "_",
    " ",
  )
}

export function fileFromUrl(url: string): string {
  return decodeURIComponent(url.slice(FILE_PATH_PREFIX.length))
}

// Titles to try, in order, for a suburb Wikidata doesn't know by SAL code.
export function fallbackTitles(name: string): string[] {
  return [`${name}, New South Wales`, name]
}

// Overrides win, including an explicit null.
export function applyOverride(
  match: WikiMatch,
  override: Overrides[string] | undefined,
): WikiMatch {
  return {
    title: override?.title === undefined ? match.title : override.title,
    image: override?.image === undefined ? match.image : override.image,
  }
}

export async function readOverrides(): Promise<Overrides> {
  return overrideSchema.parse(
    JSON.parse(await readFile(overridesPath, "utf-8")),
  )
}

function sparqlUrl(query: string) {
  return `${SPARQL_URL}?${new URLSearchParams({ query, format: "json" })}`
}

// Article and image for every suburb Wikidata has a SAL code for.
export async function queryWikidata(
  options: CacheOptions,
): Promise<Map<string, WikiMatch>> {
  const { results } = await fetchJson(
    sparqlUrl(SUBURBS_QUERY),
    sparqlResults,
    options,
  )
  const matches = new Map<string, WikiMatch>()
  for (const row of results.bindings) {
    matches.set(row.sal.value.replace(/^SAL/, ""), {
      title: row.article ? titleFromUrl(row.article.value) : null,
      image: row.image ? fileFromUrl(row.image.value) : null,
    })
  }
  return matches
}

async function isInNsw(item: string, options: CacheOptions) {
  const query = `ASK { wd:${item} wdt:P131* wd:${NEW_SOUTH_WALES} }`
  const result = await fetchJson(sparqlUrl(query), askResult, options)
  return result.boolean
}

async function lookUpTitle(title: string, options: CacheOptions) {
  const params = new URLSearchParams({
    action: "query",
    format: "json",
    formatversion: "2",
    redirects: "1",
    prop: "pageprops",
    ppprop: "wikibase_item|disambiguation",
    titles: title,
  })
  const { query } = await fetchJson(
    `${WIKIPEDIA_API}?${params}`,
    pageProps,
    options,
  )
  const page = query?.pages[0]
  const item = page?.pageprops?.wikibase_item
  if (!page || page.missing || page.pageprops?.disambiguation !== undefined) {
    return null
  }
  return item ? { title: page.title, item } : null
}

// Tries each fallback title in turn, accepting the first in NSW.
export async function findByTitle(
  name: string,
  options: CacheOptions,
): Promise<string | null> {
  for (const candidate of fallbackTitles(name)) {
    // One at a time, so the second title is only tried if the first fails.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const page = await lookUpTitle(candidate, options)
    // oxlint-disable-next-line eslint/no-await-in-loop
    if (page && (await isInNsw(page.item, options))) {
      return page.title
    }
  }
  return null
}

const SUMMARY_API = "https://en.wikipedia.org/api/rest_v1/page/summary/"
// The API takes at most 50 titles per request.
const TITLES_PER_REQUEST = 50

const summaryResponse = z.object({
  type: z.string(),
  extract: z.string(),
  content_urls: z.object({ desktop: z.object({ page: z.string() }) }),
})

export interface Summary {
  text: string | null
  url: string
}

// A newline only ends a paragraph after a full sentence; articles sometimes
// have stray line breaks mid-sentence.
const PARAGRAPH_BREAK = /(?<=[.!?)"'”])\s*\n\s*/

export function firstParagraph(extract: string): string | null {
  const [paragraph] = extract.split(PARAGRAPH_BREAK)
  return paragraph?.replaceAll(/\s+/g, " ").trim() || null
}

// The article's plain-text intro and canonical URL.
export async function readSummary(
  title: string,
  options: CacheOptions,
): Promise<Summary> {
  const page = await fetchJson(
    SUMMARY_API + encodeURIComponent(title.replaceAll(" ", "_")),
    summaryResponse,
    options,
  )
  return {
    text: page.type === "standard" ? firstParagraph(page.extract) : null,
    url: page.content_urls.desktop.page,
  }
}

const pageImages = z.object({
  query: z.optional(
    z.object({
      ...titleMappings.shape,
      pages: z.array(
        z.object({ title: z.string(), pageimage: z.optional(z.string()) }),
      ),
    }),
  ),
})

// Each article's freely licensed lead image, keyed by the title asked for.
export async function readPageImages(
  titles: string[],
  options: CacheOptions,
): Promise<Map<string, string>> {
  const images = new Map<string, string>()
  for (const batch of chunk(titles.toSorted(), TITLES_PER_REQUEST)) {
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      formatversion: "2",
      redirects: "1",
      prop: "pageimages",
      piprop: "name",
      pilicense: "free",
      pilimit: String(TITLES_PER_REQUEST),
      titles: batch.join("|"),
    })
    // Batches run one at a time to keep requests polite.
    // oxlint-disable-next-line eslint/no-await-in-loop
    const { query } = await fetchJson(
      `${WIKIPEDIA_API}?${params}`,
      pageImages,
      options,
    )
    const pages = new Map(query?.pages.map((p) => [p.title, p]))
    for (const title of batch) {
      const image = pages.get(resolveTitles(title, query))?.pageimage
      if (image) {
        images.set(title, image.replaceAll("_", " "))
      }
    }
  }
  return images
}
