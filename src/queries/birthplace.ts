import { queryOptions } from "@tanstack/solid-query"

import { rasterise } from "@/lib/raster"

import { suburbFactsQuery } from "./suburb-facts"
import { suburbsTopoQuery } from "./suburbs-topo"

// Loads in its own chunk once someone switches to the birthplace mode. The
// facts and map files never change, so neither does this.
export const birthplaceQuery = queryOptions({
  queryKey: ["birthplace"],
  queryFn: async ({ client }) => {
    const [{ birthplaceLayers }, facts, data] = await Promise.all([
      import("@/lib/birthplace"),
      client.fetchQuery(suburbFactsQuery),
      client.fetchQuery(suburbsTopoQuery),
    ])
    const layers = birthplaceLayers(facts, data)
    const fills = await Promise.all(
      layers.fills.map(async (f) =>
        f.image ? { ...f, image: await rasterise(f.image) } : f,
      ),
    )
    return { ...layers, fills }
  },
  staleTime: Infinity,
})
