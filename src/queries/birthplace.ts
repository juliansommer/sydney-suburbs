import { once } from "@/lib/load"
import { rasterise } from "@/lib/raster"

import { getSuburbFacts } from "./suburb-facts"
import { getSuburbsTopo } from "./suburbs-topo"

// Loads in its own chunk once someone switches to the birthplace mode.
export const getBirthplace = once(async () => {
  const [{ birthplaceLayers }, facts, data] = await Promise.all([
    import("@/lib/birthplace"),
    getSuburbFacts(),
    getSuburbsTopo(),
  ])
  const layers = birthplaceLayers(facts, data)
  const fills = await Promise.all(
    layers.fills.map(async (f) =>
      f.image ? { ...f, image: await rasterise(f.image) } : f,
    ),
  )
  return { ...layers, fills }
})
