import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { useEffect, useEffectEvent, useMemo } from "react"
import { z } from "zod/mini"

import { SuburbMap } from "@/components/map/suburb-map"
import { SuburbPanel } from "@/components/suburb-panel"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { mySuburbsKey, mySuburbsQuery } from "@/queries/my-suburbs"
import { suburbsTopoQuery } from "@/queries/suburbs-topo"
import type { SuburbMapData } from "@/types/suburb"
import type { UserSuburb } from "@/types/user-suburb"

// Suburb ids are ABS SAL codes, all 5-digit numbers, so the URL carries a
// number. A malformed one is just no selection.
const suburbParam = z.int()

interface MapSearch {
  suburb?: number
}

export const Route = createFileRoute("/")({
  validateSearch: (search): MapSearch => ({
    suburb: suburbParam.safeParse(search.suburb).data,
  }),
  component: MapPage,
})

type Rows = ReadonlyMap<string, UserSuburb>

function MapPage() {
  const { data, isError } = useQuery(suburbsTopoQuery)
  const { data: session, isPending } = authClient.useSession()
  const { data: rows } = useQuery({ ...mySuburbsQuery, enabled: !!session })

  return (
    <main className="relative h-dvh overflow-hidden bg-map-water">
      {isError ? (
        <p className="grid h-full place-items-center text-muted-foreground">
          The map couldn&rsquo;t load. Try refreshing.
        </p>
      ) : null}
      {data ? <MapView data={data} rows={rows} signedIn={!!session} /> : null}
      <h1 className="pointer-events-none absolute top-4 left-4 text-lg font-semibold">
        Sydney Suburbs
      </h1>
      <header className="absolute top-4 right-4">
        {isPending ? null : (
          <Account
            email={session?.user.email}
            rows={rows}
            total={data?.suburbs.length}
          />
        )}
      </header>
    </main>
  )
}

interface MapViewProps {
  data: SuburbMapData
  signedIn: boolean
  rows: Rows | undefined
}

function MapView({ data, signedIn, rows }: MapViewProps) {
  const { suburb: selectedId } = Route.useSearch()
  const navigate = Route.useNavigate()

  const byId = useMemo(
    () => new Map(data.suburbs.map((s) => [s.properties.id, s.properties])),
    [data],
  )
  const visitedIds = useMemo(
    () =>
      new Set(
        [...(rows?.values() ?? [])]
          .filter((row) => row.visited)
          .map((row) => row.suburbId),
      ),
    [rows],
  )
  // An id the map doesn't draw is no selection at all.
  const selected =
    selectedId === undefined ? undefined : byId.get(String(selectedId))

  function select(id: string | null) {
    if (id === (selected?.id ?? null)) {
      return
    }
    // Switching suburbs replaces the entry, so Back leaves the map rather
    // than stepping through every suburb looked at.
    navigate({
      search: id ? { suburb: Number(id) } : {},
      replace: !!selected && !!id,
    })
  }

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const { target } = event
    const typing =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement
    if (event.key === "Escape" && !typing) {
      select(null)
    }
  })
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return (
    <>
      <SuburbMap
        data={data}
        onSelect={select}
        selectedId={selected?.id ?? null}
        visitedIds={visitedIds}
      />
      {selected ? (
        <SuburbPanel
          key={selected.id}
          onClose={() => {
            select(null)
          }}
          rows={rows}
          signedIn={signedIn}
          suburb={selected}
        />
      ) : null}
    </>
  )
}

interface AccountProps {
  email: string | undefined
  rows: Rows | undefined
  total: number | undefined
}

function Account({ email, rows, total }: AccountProps) {
  const queryClient = useQueryClient()

  if (email === undefined) {
    return (
      <Link className={buttonVariants()} to="/login">
        Sign in
      </Link>
    )
  }

  const visited = [...(rows?.values() ?? [])].filter((r) => r.visited).length

  return (
    <div className="flex items-center gap-2 text-sm">
      {rows && total !== undefined ? (
        <span className="font-medium">
          {visited} / {total} suburbs
        </span>
      ) : null}
      <span className="text-muted-foreground">{email}</span>
      <Button
        onClick={async () => {
          await authClient.signOut()
          // Disabled queries keep their data, so drop it or the next person
          // on this browser would see these visits.
          queryClient.removeQueries({ queryKey: mySuburbsKey })
        }}
        variant="outline"
      >
        Sign out
      </Button>
    </div>
  )
}
