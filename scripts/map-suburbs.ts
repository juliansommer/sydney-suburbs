// The map's suburbs, read from its TopoJSON file.

import { readFile } from "node:fs/promises"

import { array, object, parse, string } from "valibot"

import { root } from "./download.ts"

const topoPath = `${root}public/sydney-suburbs.topo.json`

const topoSuburbs = object({
  objects: object({
    suburbs: object({
      geometries: array(
        object({
          properties: object({
            id: string(),
            name: string(),
            lga: string(),
          }),
        }),
      ),
    }),
  }),
})

export interface MapSuburb {
  id: string
  name: string
  lga: string
}

// The map's suburbs, so the facts always cover exactly the same set.
export async function readMapSuburbs(): Promise<MapSuburb[]> {
  const topo = parse(topoSuburbs, JSON.parse(await readFile(topoPath, "utf-8")))

  return topo.objects.suburbs.geometries
    .map((g) => g.properties)
    .toSorted((a, b) => a.id.localeCompare(b.id))
}
