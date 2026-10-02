import { Drawer } from "@base-ui/react/drawer"
import { Link } from "@tanstack/react-router"
import { XIcon } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import {
  FactsRow,
  SuburbMedia,
  useSuburbFacts,
} from "@/components/suburb-facts"
import { Button, buttonVariants } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { councilName } from "@/lib/council"
import { sydneyToday } from "@/lib/dates"
import { useUpdateSuburb } from "@/mutations/use-update-suburb"
import type { SuburbProperties } from "@/types/suburb"
import type { UserSuburb } from "@/types/user-suburb"

const NOTES_DEBOUNCE_MS = 600
const NOTES_MAX_LENGTH = 10_000

type Suburb = Pick<SuburbProperties, "id" | "name" | "lga">

interface SuburbPanelProps {
  // Undefined when nothing is selected.
  suburb: Suburb | undefined
  signedIn: boolean
  // The user's rows, or undefined while they load.
  rows: ReadonlyMap<string, UserSuburb> | undefined
  onClose: () => void
  // Outlines the council on the map, like the progress list does.
  onZoomToCouncil: (lga: string) => void
}

// Tailwind's `md`: a card beside the map from here up, a bottom sheet below.
const DESKTOP = "(min-width: 768px)"
// Tall enough for the name, the council and the visited button.
const PEEK = "9.5rem"
const SNAP_POINTS = [PEEK, 1]

export function SuburbPanel(props: SuburbPanelProps) {
  const desktop = useMediaQuery(DESKTOP)
  return desktop ? <SuburbCard {...props} /> : <SuburbSheet {...props} />
}

// The photo runs edge to edge across the top, with the close button over it.
function SuburbCard({
  suburb,
  signedIn,
  rows,
  onClose,
  onZoomToCouncil,
}: SuburbPanelProps) {
  const facts = useSuburbFacts(suburb?.id)
  if (!suburb) {
    return null
  }
  return (
    <section
      aria-label={suburb.name}
      className="absolute top-16 right-4 flex max-h-[calc(100dvh-5rem)] w-80 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg"
    >
      <div className="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm">
        <CloseButton onClose={onClose} />
      </div>
      <div className="overflow-y-auto">
        <SuburbMedia name={suburb.name} state={facts} />
        <div className="flex flex-col gap-4 p-4">
          <header className="pr-8">
            <h2 className="text-lg font-semibold">{suburb.name}</h2>
            <p className="text-sm text-muted-foreground">
              <CouncilButton lga={suburb.lga} onZoom={onZoomToCouncil} />
            </p>
            <FactsRow state={facts} />
          </header>
          <PanelBody
            key={suburb.id}
            rows={rows}
            signedIn={signedIn}
            suburbId={suburb.id}
          />
        </div>
      </div>
    </section>
  )
}

// Non-modal, so the map stays usable above it and tapping another suburb
// swaps the content in place. Swiping down from the peek closes it. Stays
// mounted so it can slide in and out, keeping the last suburb while it leaves.
function SuburbSheet({
  suburb,
  signedIn,
  rows,
  onClose,
  onZoomToCouncil,
}: SuburbPanelProps) {
  const [snapPoint, setSnapPoint] = useState<Drawer.Root.SnapPoint | null>(PEEK)
  const [shown, setShown] = useState(suburb)
  if (suburb && suburb !== shown) {
    setShown(suburb)
  }
  return (
    <Drawer.Root
      disablePointerDismissal
      modal={false}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setSnapPoint(PEEK)
        }
      }}
      onSnapPointChange={setSnapPoint}
      open={!!suburb}
      snapPoint={snapPoint}
      snapPoints={SNAP_POINTS}
    >
      <Drawer.VirtualKeyboardProvider>
        {shown ? (
          <SheetPopup
            onClose={onClose}
            // Drops to the peek so the outlined council is in view.
            onZoomToCouncil={(lga) => {
              setSnapPoint(PEEK)
              onZoomToCouncil(lga)
            }}
            rows={rows}
            signedIn={signedIn}
            suburb={shown}
          />
        ) : null}
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  )
}

interface SheetPopupProps extends SuburbPanelProps {
  suburb: Suburb
}

// The peek shows the name and visit controls; the photo and facts
// sit below and come into view as the sheet expands.
function SheetPopup({
  suburb,
  signedIn,
  rows,
  onClose,
  onZoomToCouncil,
}: SheetPopupProps) {
  const facts = useSuburbFacts(suburb.id)
  return (
    <Drawer.Portal>
      <Drawer.Viewport className="pointer-events-none fixed inset-0 flex items-end">
        <Drawer.Popup
          aria-label={suburb.name}
          className="pointer-events-auto flex max-h-[calc(100dvh-4rem)] w-full [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] touch-none flex-col rounded-t-xl border-t bg-card text-card-foreground shadow-lg transition-transform duration-450 ease-sheet outline-none data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none motion-reduce:transition-none"
          initialFocus={false}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <header className="flex shrink-0 items-start justify-between gap-2 px-4 pt-2 pb-4">
            <div>
              <Drawer.Title className="text-lg font-semibold">
                {suburb.name}
              </Drawer.Title>
              <Drawer.Description className="text-sm text-muted-foreground">
                <CouncilButton lga={suburb.lga} onZoom={onZoomToCouncil} />
              </Drawer.Description>
            </div>
            <CloseButton onClose={onClose} />
          </header>
          <Drawer.Content className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 pb-safe-bottom">
            <div className="flex flex-col gap-4 pb-4">
              <PanelBody
                key={suburb.id}
                rows={rows}
                signedIn={signedIn}
                suburbId={suburb.id}
              />
              <SuburbMedia
                className="mx-auto w-full overflow-hidden rounded-lg border"
                name={suburb.name}
                state={facts}
              />
              <FactsRow state={facts} />
            </div>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Viewport>
    </Drawer.Portal>
  )
}

interface CouncilButtonProps {
  lga: string
  onZoom: (lga: string) => void
}

function CouncilButton({ lga, onZoom }: CouncilButtonProps) {
  return (
    <button
      className="hover:text-foreground hover:underline"
      onClick={() => {
        onZoom(lga)
      }}
      type="button"
    >
      {councilName(lga)}
    </button>
  )
}

interface CloseButtonProps {
  onClose: () => void
}

function CloseButton({ onClose }: CloseButtonProps) {
  return (
    <Button aria-label="Close" onClick={onClose} size="icon-sm" variant="ghost">
      <XIcon />
    </Button>
  )
}

interface PanelBodyProps {
  suburbId: string
  signedIn: boolean
  rows: ReadonlyMap<string, UserSuburb> | undefined
}

function PanelBody({ suburbId, signedIn, rows }: PanelBodyProps) {
  if (!signedIn) {
    return (
      <Link
        className={buttonVariants({ variant: "outline" })}
        search={{ redirect: `/?suburb=${suburbId}` }}
        to="/login"
      >
        Sign in to track your visits
      </Link>
    )
  }
  if (!rows) {
    return <p className="text-sm text-muted-foreground">Loading&hellip;</p>
  }
  return <VisitForm row={rows.get(suburbId)} suburbId={suburbId} />
}

interface VisitFormProps {
  suburbId: string
  row: UserSuburb | undefined
}

function VisitForm({ suburbId, row }: VisitFormProps) {
  const visit = useUpdateSuburb(suburbId)
  const notes = useUpdateSuburb(suburbId)
  const visited = row?.visited ?? false
  const today = sydneyToday()

  return (
    <div className="flex flex-col gap-4">
      <Button
        aria-pressed={visited}
        onClick={() => {
          visit.mutate({ visited: !visited })
        }}
        size="lg"
        variant={visited ? "default" : "outline"}
      >
        {visited ? "Visited ✓" : "Mark visited"}
      </Button>
      {visited ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Date visited</span>
          <input
            className="h-8 rounded-lg border bg-background px-2.5"
            max={today}
            onChange={(event) => {
              const date = event.target.value
              if (date <= today) {
                visit.mutate({ visitedOn: date || null })
              }
            }}
            type="date"
            value={row?.visitedOn ?? ""}
          />
        </label>
      ) : null}
      <NotesField
        initial={row?.notes ?? ""}
        isSaved={notes.isSuccess}
        isSaving={notes.isPending}
        onSave={(value) => {
          notes.mutate({ notes: value })
        }}
      />
      {visit.isError || notes.isError ? (
        <p className="text-sm text-destructive" role="alert">
          Couldn&rsquo;t save that. Try again.
        </p>
      ) : null}
    </div>
  )
}

interface NotesFieldProps {
  initial: string
  isSaving: boolean
  isSaved: boolean
  onSave: (notes: string) => void
}

// Saves once typing stops, and flushes anything unsaved when the panel closes
// or the page is hidden (tab switch, app switch, navigating away).
function NotesField({ initial, isSaving, isSaved, onSave }: NotesFieldProps) {
  const [value, setValue] = useState(initial)
  const [dirty, setDirty] = useState(false)
  const pending = useRef<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined)

  function flush() {
    clearTimeout(timer.current)
    if (pending.current !== null) {
      onSave(pending.current)
      pending.current = null
      setDirty(false)
    }
  }
  const onFlush = useEffectEvent(flush)

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        onFlush()
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
      onFlush()
    }
  }, [])

  let status = ""
  if (dirty || isSaving) {
    status = "Saving…"
  } else if (isSaved) {
    status = "Saved"
  }

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between text-muted-foreground">
        Notes
        <span aria-live="polite">{status}</span>
      </span>
      <textarea
        className="min-h-24 resize-y rounded-lg border bg-background px-2.5 py-2"
        maxLength={NOTES_MAX_LENGTH}
        onChange={(event) => {
          setValue(event.target.value)
          setDirty(true)
          pending.current = event.target.value
          clearTimeout(timer.current)
          timer.current = setTimeout(flush, NOTES_DEBOUNCE_MS)
        }}
        placeholder="What's worth going back for?"
        value={value}
      />
    </label>
  )
}
