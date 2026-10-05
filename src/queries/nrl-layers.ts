import { queryOptions } from "@tanstack/react-query"

import { suburbsTopoQuery } from "./suburbs-topo"

// The territories and their maths load in their own chunk, only once someone
// switches to the NRL mode. The map data never changes, so neither do these.
export const nrlLayersQuery = queryOptions({
  queryKey: ["nrl-layers"],
  queryFn: async ({ client }) => {
    const [{ nrlLayers }, data] = await Promise.all([
      import("@/lib/nrl"),
      client.query(suburbsTopoQuery),
    ])
    return nrlLayers(data)
  },
  staleTime: Infinity,
})
