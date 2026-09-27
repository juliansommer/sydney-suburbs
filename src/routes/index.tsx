import { useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
} from "react"
import { z } from "zod/mini"

import { CouncilProgressButton } from "@/components/council-progress"
import { SuburbMap, type SuburbMapHandle } from "@/components/map/suburb-map"
import { SuburbSearch } from "@/components/map/suburb-search"
import { SuburbPanel } from "@/components/suburb-panel"
import { Button, buttonVariants } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { mySuburbsKey, mySuburbsQuery } from "@/queries/my-suburbs"
import { suburbsTopoQuery } from "@/queries/suburbs-topo"
import type { SuburbMapData, SuburbProperties } from "@/types/suburb"
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
  const map = useRef<SuburbMapHandle>(null)
  const suburbs = useMemo(
    () => data?.suburbs.map((s) => s.properties) ?? [],
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

  return (
    <main className="relative h-dvh overflow-hidden bg-map-water">
      {isError ? (
        <p className="grid h-full place-items-center text-muted-foreground">
          The map couldn&rsquo;t load. Try refreshing.
        </p>
      ) : null}
      {data ? (
        <MapView
          data={data}
          map={map}
          rows={rows}
          signedIn={!!session}
          suburbs={suburbs}
          visitedIds={visitedIds}
        />
      ) : null}
      <h1 className="pointer-events-none absolute top-4 left-4 text-lg font-semibold">
        Sydney Suburbs
      </h1>
      <header className="absolute top-4 right-4">
        {isPending ? null : (
          <Account signedIn={!!session}>
            {rows && data ? (
              <CouncilProgressButton
                onZoom={(ids) => {
                  map.current?.zoomTo(ids)
                }}
                suburbs={suburbs}
                visitedIds={visitedIds}
              />
            ) : null}
          </Account>
        )}
      </header>
    </main>
  )
}

interface MapViewProps {
  data: SuburbMapData
  map: RefObject<SuburbMapHandle | null>
  suburbs: SuburbProperties[]
  visitedIds: ReadonlySet<string>
  signedIn: boolean
  rows: Rows | undefined
}

function MapView({
  data,
  map,
  suburbs,
  visitedIds,
  signedIn,
  rows,
}: MapViewProps) {
  const { suburb: selectedId } = Route.useSearch()
  const navigate = Route.useNavigate()

  const byId = useMemo(() => new Map(suburbs.map((s) => [s.id, s])), [suburbs])
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
        ref={map}
        selectedId={selected?.id ?? null}
        visitedIds={visitedIds}
      />
      <div className="absolute inset-x-4 top-14 md:right-auto md:w-72">
        <SuburbSearch
          onPick={(id) => {
            select(id)
            map.current?.zoomTo([id])
          }}
          suburbs={suburbs}
          visitedIds={visitedIds}
        />
      </div>
      {selected ? (
        <SuburbPanel
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
  signedIn: boolean
  // Shown beside Sign out, e.g. the progress counter.
  children?: ReactNode
}

function Account({ signedIn, children }: AccountProps) {
  const queryClient = useQueryClient()

  if (!signedIn) {
    return (
      <Link className={buttonVariants()} to="/login">
        Sign in
      </Link>
    )
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      {children}
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
