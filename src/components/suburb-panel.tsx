import XIcon from "@lucide/solid/icons/x"
import { Link } from "@tanstack/solid-router"
import { Drawer, type DrawerRoot } from "base-ui-solid/drawer"
import {
  createMemo,
  createSignal,
  Match,
  onCleanup,
  onSettled,
  Show,
  Switch,
  untrack,
} from "solid-js"

import {
  FactsRow,
  MoreDetails,
  SuburbMedia,
  Summary,
  useSuburbFacts,
} from "@/components/suburb-facts"
import { Button, buttonVariants } from "@/components/ui/button"
import { useMediaQuery } from "@/hooks/use-media-query"
import { councilName } from "@/lib/council"
import { sydneyToday } from "@/lib/dates"
import type { Overlay } from "@/lib/stats"
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
  // What the map is showing from the panel, if anything.
  overlay: Overlay | undefined
  onToggleOverlay: (overlay: Overlay) => void
}

// Tailwind's `md`: a card beside the map from here up, a bottom sheet below.
const DESKTOP = "(min-width: 768px)"
// Tall enough for the name, the council and the visited button.
const PEEK = "9.5rem"
const SNAP_POINTS = [PEEK, 1]

export function SuburbPanel(props: SuburbPanelProps) {
  const desktop = useMediaQuery(DESKTOP)
  return (
    <Show fallback={<SuburbSheet {...props} />} when={desktop()}>
      <SuburbCard {...props} />
    </Show>
  )
}

// The photo runs edge to edge across the top, with the close button over it.
function SuburbCard(props: SuburbPanelProps) {
  const facts = useSuburbFacts(() => props.suburb?.id)
  return (
    <Show when={props.suburb}>
      {(suburb) => (
        <section
          aria-label={suburb().name}
          class="absolute top-16 right-4 flex max-h-[calc(100dvh-5rem)] w-80 flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-lg"
        >
          <div class="absolute top-2 right-2 z-10 rounded-full bg-background/80 backdrop-blur-sm">
            <CloseButton onClose={props.onClose} />
          </div>
          <div class="overflow-y-auto">
            <SuburbMedia name={suburb().name} state={facts()} />
            <div class="flex flex-col gap-4 p-4">
              <div class="flex flex-col gap-2">
                <header class="pr-8">
                  <h2 class="text-lg font-semibold">{suburb().name}</h2>
                  <p class="text-sm text-muted-foreground">
                    <CouncilButton
                      lga={suburb().lga}
                      onZoom={props.onZoomToCouncil}
                    />
                  </p>
                  <FactsRow state={facts()} />
                </header>
                <Summary state={facts()} />
                <MoreDetails
                  onToggleOverlay={props.onToggleOverlay}
                  overlay={props.overlay}
                  state={facts()}
                />
              </div>
              <PanelBody
                rows={props.rows}
                signedIn={props.signedIn}
                suburbId={suburb().id}
              />
            </div>
          </div>
        </section>
      )}
    </Show>
  )
}

// Non-modal, so the map stays usable above it and tapping another suburb
// swaps the content in place. Swiping down from the peek closes it. Stays
// mounted so it can slide in and out, keeping the last suburb while it leaves.
function SuburbSheet(props: SuburbPanelProps) {
  const [snapPoint, setSnapPoint] = createSignal<DrawerRoot.SnapPoint | null>(
    PEEK,
  )
  const shown = createMemo<Suburb | undefined>((prev) => props.suburb ?? prev)
  return (
    <Drawer.Root
      disablePointerDismissal
      modal={false}
      onOpenChange={(open) => {
        if (!open) {
          props.onClose()
        }
      }}
      onOpenChangeComplete={(open) => {
        if (!open) {
          setSnapPoint(PEEK)
        }
      }}
      onSnapPointChange={setSnapPoint}
      open={!!props.suburb}
      snapPoint={snapPoint()}
      snapPoints={SNAP_POINTS}
    >
      <Drawer.VirtualKeyboardProvider>
        <Show when={shown()}>
          {(suburb) => (
            <SheetPopup
              onClose={props.onClose}
              onToggleOverlay={props.onToggleOverlay}
              // Drops to the peek so the outlined council is in view.
              onZoomToCouncil={(lga) => {
                setSnapPoint(PEEK)
                props.onZoomToCouncil(lga)
              }}
              overlay={props.overlay}
              rows={props.rows}
              signedIn={props.signedIn}
              suburb={suburb()}
            />
          )}
        </Show>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  )
}

interface SheetPopupProps extends SuburbPanelProps {
  suburb: Suburb
}

// The peek shows the name and visit controls; the photo, facts and summary
// sit below and come into view as the sheet expands.
function SheetPopup(props: SheetPopupProps) {
  const facts = useSuburbFacts(() => props.suburb.id)
  return (
    <Drawer.Portal>
      <Drawer.Viewport class="pointer-events-none fixed inset-0 flex items-end">
        <Drawer.Popup
          aria-label={props.suburb.name}
          class="pointer-events-auto flex max-h-[calc(100dvh-4rem)] w-full [transform:translateY(calc(var(--drawer-snap-point-offset)+var(--drawer-swipe-movement-y)))] touch-none flex-col rounded-t-xl border-t bg-card text-card-foreground shadow-lg transition-transform duration-450 ease-sheet outline-none data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none motion-reduce:transition-none"
          initialFocus={false}
        >
          <div class="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/30" />
          <header class="flex shrink-0 items-start justify-between gap-2 px-4 pt-2 pb-4">
            <div>
              <Drawer.Title class="text-lg font-semibold">
                {props.suburb.name}
              </Drawer.Title>
              <Drawer.Description class="text-sm text-muted-foreground">
                <CouncilButton
                  lga={props.suburb.lga}
                  onZoom={props.onZoomToCouncil}
                />
              </Drawer.Description>
            </div>
            <CloseButton onClose={props.onClose} />
          </header>
          <Drawer.Content class="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 pb-safe-bottom">
            <div class="flex flex-col gap-4 pb-4">
              <PanelBody
                rows={props.rows}
                signedIn={props.signedIn}
                suburbId={props.suburb.id}
              />
              <SuburbMedia
                class="mx-auto w-full overflow-hidden rounded-lg border"
                name={props.suburb.name}
                state={facts()}
              />
              <div class="flex flex-col gap-2">
                <FactsRow state={facts()} />
                <Summary state={facts()} />
                <MoreDetails
                  onToggleOverlay={props.onToggleOverlay}
                  overlay={props.overlay}
                  state={facts()}
                />
              </div>
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

function CouncilButton(props: CouncilButtonProps) {
  return (
    <button
      class="hover:text-foreground hover:underline"
      onClick={() => {
        props.onZoom(props.lga)
      }}
      type="button"
    >
      {councilName(props.lga)}
    </button>
  )
}

interface CloseButtonProps {
  onClose: () => void
}

function CloseButton(props: CloseButtonProps) {
  return (
    <Button
      aria-label="Close"
      onClick={props.onClose}
      size="icon-sm"
      variant="ghost"
    >
      <XIcon />
    </Button>
  )
}

interface PanelBodyProps {
  suburbId: string
  signedIn: boolean
  rows: ReadonlyMap<string, UserSuburb> | undefined
}

// Keyed on the suburb, so the form and its unsaved notes start fresh for each.
function PanelBody(props: PanelBodyProps) {
  return (
    <Switch
      fallback={<p class="text-sm text-muted-foreground">Loading&hellip;</p>}
    >
      <Match when={!props.signedIn}>
        <Link
          class={buttonVariants({ variant: "outline" })}
          search={{ redirect: `/?suburb=${props.suburbId}` }}
          to="/login"
        >
          Sign in to track your visits
        </Link>
      </Match>
      <Match when={props.rows}>
        {(rows) => (
          <Show keyed when={props.suburbId}>
            {(suburbId) => (
              <VisitForm row={rows().get(suburbId)} suburbId={suburbId} />
            )}
          </Show>
        )}
      </Match>
    </Switch>
  )
}

interface VisitFormProps {
  suburbId: string
  row: UserSuburb | undefined
}

function VisitForm(props: VisitFormProps) {
  const visit = useUpdateSuburb(props.suburbId)
  const notes = useUpdateSuburb(props.suburbId)
  const visited = () => props.row?.visited ?? false
  const today = sydneyToday()

  return (
    <div class="flex flex-col gap-4">
      <Button
        aria-pressed={visited() ? "true" : "false"}
        onClick={() => {
          void visit.mutate({ visited: !visited() })
        }}
        size="lg"
        variant={visited() ? "default" : "outline"}
      >
        {visited() ? "Visited ✓" : "Mark Visited"}
      </Button>
      <Show when={visited()}>
        <label class="flex flex-col gap-1 text-sm">
          <span class="text-muted-foreground">Date visited</span>
          <input
            class="h-8 rounded-lg border bg-background px-2.5"
            max={today}
            onChange={(event) => {
              const date = event.currentTarget.value
              if (date <= today) {
                void visit.mutate({ visitedOn: date || null })
              }
            }}
            type="date"
            value={props.row?.visitedOn ?? ""}
          />
        </label>
      </Show>
      <NotesField
        initial={props.row?.notes ?? ""}
        isSaved={notes.isSuccess}
        isSaving={notes.isPending}
        onSave={(value) => {
          void notes.mutate({ notes: value })
        }}
      />
      <Show when={visit.isError || notes.isError}>
        <p class="text-sm text-destructive" role="alert">
          Couldn&rsquo;t save that. Try again.
        </p>
      </Show>
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
function NotesField(props: NotesFieldProps) {
  // Read once, so a refetch landing mid-typing doesn't overwrite the textarea.
  const initial = untrack(() => props.initial)
  const [dirty, setDirty] = createSignal(false)
  let pending: string | null = null
  let timer: ReturnType<typeof setTimeout> | undefined

  function flush() {
    clearTimeout(timer)
    if (pending !== null) {
      props.onSave(pending)
      pending = null
      setDirty(false)
    }
  }

  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") {
      flush()
    }
  }
  onSettled(() => {
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  })
  onCleanup(flush)

  const status = () => {
    if (dirty() || props.isSaving) {
      return "Saving…"
    }
    return props.isSaved ? "Saved" : ""
  }

  return (
    <label class="flex flex-col gap-1 text-sm">
      <span class="flex justify-between text-muted-foreground">
        Notes
        <span aria-live="polite">{status()}</span>
      </span>
      <textarea
        class="min-h-24 resize-y rounded-lg border bg-background px-2.5 py-2"
        maxlength={NOTES_MAX_LENGTH}
        onInput={(event) => {
          setDirty(true)
          pending = event.currentTarget.value
          clearTimeout(timer)
          timer = setTimeout(flush, NOTES_DEBOUNCE_MS)
        }}
        placeholder="What's worth going back for?"
        value={initial}
      />
    </label>
  )
}
