import type { QueryClient } from "@tanstack/react-query"
import {
  createRootRouteWithContext,
  Link,
  Outlet,
} from "@tanstack/react-router"

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: NotFound,
})

function RootLayout() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Outlet />
    </div>
  )
}

function NotFound() {
  return (
    <p className="p-4 text-slate-600">
      No such page. <Link to="/">Back to the map</Link>
    </p>
  )
}
