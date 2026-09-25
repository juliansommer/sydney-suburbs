import { QueryClient } from "@tanstack/react-query"
import { createRouter } from "@tanstack/react-router"

import { routeTree } from "@/routeTree.gen"

export function createAppRouter() {
  const queryClient = new QueryClient()

  const router = createRouter({
    routeTree,
    // Route loaders prefetch through the query client; Query owns the cache
    // from there, so the router's own one would only be a second copy of the
    // same data with a different expiry.
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    context: { queryClient },
    scrollRestoration: true,
  })

  return { router, queryClient }
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>["router"]
  }
}
