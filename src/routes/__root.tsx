import type { QueryClient } from "@tanstack/solid-query"
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/solid-router"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div class="min-h-screen bg-background text-foreground">
      <Outlet />
    </div>
  )
}

function NotFound() {
  return (
    <p class="p-4 text-muted-foreground">
      No such page. <Link to="/">Back to the map</Link>
    </p>
  )
}
