import { once } from "@/lib/load"

import { getSuburbFacts } from "./suburb-facts"
import { getSuburbsTopo } from "./suburbs-topo"

// Loads in its own chunk once someone switches to the birthplace mode.
export const getBirthplace = once(async () => {
  const [{ birthplaceLayers }, facts, data] = await Promise.all([
    import("@/lib/birthplace"),
    getSuburbFacts(),
    getSuburbsTopo(),
  ])
  return birthplaceLayers(facts, data)
})
