// Resizes suburb photos and uploads them to Vercel Blob under immutable names.

import { createHash } from "node:crypto"

import { del, list, put } from "@vercel/blob"
import sharp from "sharp"

import type { SuburbPhoto } from "../../src/types/suburb-facts.ts"
import { type CacheOptions, fetchCached } from "../download.ts"
import type { PhotoSource } from "./commons.ts"

const PREFIX = "suburbs/"
const WIDTH = 800
const QUALITY = 75
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60
const HASH_LENGTH = 8

export interface ProcessedPhoto {
  pathname: string
  body: Buffer
  width: number
  height: number
}

// The name includes a hash of the contents, so a changed photo gets a new
// URL and a cached copy can never go stale.
export function photoPathname(id: string, body: Uint8Array): string {
  const hash = createHash("sha256").update(body).digest("hex")
  return `${PREFIX}${id}-${hash.slice(0, HASH_LENGTH)}.webp`
}

export async function processPhoto(
  id: string,
  original: Uint8Array,
): Promise<ProcessedPhoto> {
  const { data, info } = await sharp(original)
    .rotate()
    .resize({ width: WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer({ resolveWithObject: true })
  return {
    pathname: photoPathname(id, data),
    body: data,
    width: info.width,
    height: info.height,
  }
}

// Every blob under the prefix, keyed by pathname.
async function listBlobs(cursor?: string): Promise<Map<string, string>> {
  const page = await list({ prefix: PREFIX, cursor })
  const blobs = new Map(page.blobs.map((b) => [b.pathname, b.url]))
  if (!page.hasMore) {
    return blobs
  }
  return new Map([...blobs, ...(await listBlobs(page.cursor))])
}

async function storePhoto(photo: ProcessedPhoto): Promise<string> {
  const blob = await put(photo.pathname, photo.body, {
    access: "public",
    addRandomSuffix: false,
    allowOverwrite: true,
    cacheControlMaxAge: ONE_YEAR_SECONDS,
    contentType: "image/webp",
  })
  return blob.url
}

interface UploadOptions extends CacheOptions {
  // Delete blobs no longer referenced by any suburb.
  prune: boolean
}

export interface UploadResult {
  photos: Map<string, SuburbPhoto>
  uploaded: number
  failed: string[]
  pruned: number
}

// Downloads, resizes and uploads each suburb's photo, skipping uploads
// that already exist. One at a time, to keep Wikimedia requests polite.
export async function uploadPhotos(
  sources: Map<string, PhotoSource>,
  { prune, ...options }: UploadOptions,
): Promise<UploadResult> {
  const existing = await listBlobs()
  const photos = new Map<string, SuburbPhoto>()
  const failed: string[] = []
  let uploaded = 0
  for (const [id, source] of sources) {
    try {
      // oxlint-disable-next-line eslint/no-await-in-loop
      const original = await fetchCached(source.thumbUrl, options)
      // oxlint-disable-next-line eslint/no-await-in-loop
      const photo = await processPhoto(id, original)
      const url =
        existing.get(photo.pathname) ??
        // oxlint-disable-next-line eslint/no-await-in-loop
        (await storePhoto(photo))
      if (!existing.has(photo.pathname)) {
        uploaded += 1
      }
      photos.set(id, {
        url,
        width: photo.width,
        height: photo.height,
        artist: source.artist,
        licence: source.licence,
        licenceUrl: source.licenceUrl,
        sourceUrl: source.sourceUrl,
      })
    } catch (error) {
      console.warn(`Photo failed for ${id}: ${String(error)}`)
      failed.push(id)
    }
  }
  const referenced = new Set([...photos.values()].map((p) => p.url))
  const unreferenced = [...existing.values()].filter(
    (url) => !referenced.has(url),
  )
  if (prune && unreferenced.length > 0) {
    await del(unreferenced)
  }
  return {
    photos,
    uploaded,
    failed,
    pruned: prune ? unreferenced.length : 0,
  }
}
