import { queryOptions } from "@tanstack/react-query"

import { suburbFactsQuery } from "./suburb-facts"
import { suburbsTopoQuery } from "./suburbs-topo"

// Loads in its own chunk once someone switches to the birthplace mode. The
// facts and map files never change, so neither does this.
export const birthplaceQuery = queryOptions({
  queryKey: ["birthplace"],
  queryFn: async ({ client }) => {
    const [{ birthplaceLayers }, facts, data] = await Promise.all([
      import("@/lib/birthplace"),
      client.query(suburbFactsQuery),
      client.query(suburbsTopoQuery),
    ])
    return birthplaceLayers(facts, data)
  },
  staleTime: Infinity,
})
