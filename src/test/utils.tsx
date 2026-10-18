import { render } from "@solidjs/testing-library"
import { QueryClientProvider } from "@tanstack/solid-query"
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from "@tanstack/solid-router"

import { createQueryClient } from "@/lib/query-client"
import { routeTree } from "@/routeTree.gen"

// Renders the real route tree at `path`, with a fresh query client per test so
// cached data never leaks between tests. Retries are off so a failing query
// fails the test immediately instead of after the default backoff.
export async function renderRoute(path: string) {
  const queryClient = createQueryClient({ retry: false })
  const router = createRouter({
    routeTree,
    context: { queryClient },
    history: createMemoryHistory({ initialEntries: [path] }),
  })

  const result = render(() => (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  ))
  await router.load()
  return { ...result, router, queryClient }
}
