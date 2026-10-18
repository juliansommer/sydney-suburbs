import { once } from "@/lib/load"

import { getSuburbsTopo } from "./suburbs-topo"

// The territories and their maths load in their own chunk, only once someone
// switches to the NRL mode.
export const getNrlLayers = once(async () => {
  const [{ nrlLayers }, data] = await Promise.all([
    import("@/lib/nrl"),
    getSuburbsTopo(),
  ])
  return nrlLayers(data)
})
