import { useQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"

import { SuburbMap } from "@/components/map/suburb-map"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { suburbsTopoQuery } from "@/queries/suburbs-topo"

export const Route = createFileRoute("/")({
  component: MapPage,
})

function MapPage() {
  return (
    <main className="relative h-dvh overflow-hidden bg-map-water">
      <MapView />
      <h1 className="pointer-events-none absolute top-4 left-4 text-lg font-semibold">
        Sydney Suburbs
      </h1>
      <header className="absolute top-4 right-4">
        <Account />
      </header>
    </main>
  )
}

function MapView() {
  const { data, isError } = useQuery(suburbsTopoQuery)

  if (isError) {
    return (
      <p className="grid h-full place-items-center text-muted-foreground">
        The map couldn&rsquo;t load. Try refreshing.
      </p>
    )
  }

  return data ? <SuburbMap data={data} /> : null
}

function Account() {
  const { data: session, isPending } = authClient.useSession()

  if (isPending) {
    return null
  }

  if (!session) {
    return (
      <Link className={buttonVariants()} to="/login">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{session.user.email}</span>
      <Button
        onClick={async () => {
          await authClient.signOut()
        }}
        variant="outline"
      >
        Sign out
      </Button>
    </div>
  )
}
