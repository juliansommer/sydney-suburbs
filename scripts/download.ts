// Cached downloads shared by the build scripts. Files land in `.cache/`, so
// reruns skip anything already fetched.

import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { mkdir, readFile, writeFile } from "node:fs/promises"
import { setTimeout as sleep } from "node:timers/promises"
import { fileURLToPath } from "node:url"

import type { z } from "zod/mini"

export const root = fileURLToPath(new URL("..", import.meta.url))
export const absCacheDir = `${root}.cache/abs/`
const wikiCacheDir = `${root}.cache/wiki/`

// Wikimedia asks API clients to identify themselves with a way to get in touch.
const USER_AGENT =
  "sydney-suburbs/1.0 (https://github.com/juliansommer/sydney-suburbs)"
const REQUEST_GAP_MS = 200
const MAX_ATTEMPTS = 5
const DEFAULT_RETRY_SECONDS = 5

// Downloads `url` to `.cache/abs/{file}` unless it is already there.
export async function download(file: string, url: string): Promise<string> {
  const path = absCacheDir + file
  if (existsSync(path)) {
    return path
  }
  await mkdir(absCacheDir, { recursive: true })
  console.log(`Downloading ${file}`)
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Download failed: ${file} (${res.status})`)
  }
  await writeFile(path, new Uint8Array(await res.arrayBuffer()))
  return path
}

let lastRequestAt = 0

// One request at a time with a gap between them, backing off on 429 and 503
// as long as the server's Retry-After says.
async function politeFetch(url: string, attempt = 1): Promise<Uint8Array> {
  await sleep(Math.max(0, lastRequestAt + REQUEST_GAP_MS - Date.now()))
  lastRequestAt = Date.now()
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } })
  if (res.ok) {
    return new Uint8Array(await res.arrayBuffer())
  }
  const retryable = res.status === 429 || res.status === 503
  if (!retryable || attempt === MAX_ATTEMPTS) {
    throw new Error(`Request failed: ${url} (${res.status})`)
  }
  const seconds = Number(res.headers.get("Retry-After"))
  const waitSeconds =
    Number.isFinite(seconds) && seconds > 0 ? seconds : DEFAULT_RETRY_SECONDS
  console.log(`Rate limited, retrying in ${waitSeconds}s`)
  await sleep(waitSeconds * 1000)
  return await politeFetch(url, attempt + 1)
}

export interface CacheOptions {
  // Ignore what's cached and fetch again.
  refresh?: boolean
}

// Fetches `url` from Wikimedia, cached under `.cache/wiki/` by a hash of the URL.
export async function fetchCached(
  url: string,
  { refresh = false }: CacheOptions = {},
): Promise<Uint8Array> {
  const key = createHash("sha256").update(url).digest("hex")
  const path = wikiCacheDir + key
  if (!refresh && existsSync(path)) {
    return new Uint8Array(await readFile(path))
  }
  await mkdir(wikiCacheDir, { recursive: true })
  const body = await politeFetch(url)
  await writeFile(path, body)
  return body
}

// Fetches and parses JSON, so callers get a typed value back.
export async function fetchJson<T>(
  url: string,
  schema: z.ZodMiniType<T>,
  options?: CacheOptions,
): Promise<T> {
  const body = await fetchCached(url, options)
  return schema.parse(JSON.parse(new TextDecoder().decode(body)))
}
