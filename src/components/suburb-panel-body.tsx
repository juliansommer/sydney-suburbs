import XIcon from "@lucide/solid/icons/x"
import {
  createSignal,
  Loading,
  onCleanup,
  onSettled,
  Show,
  untrack,
} from "solid-js"

import { Button, buttonVariants } from "@/components/ui/button"
import { councilName } from "@/lib/council"
import { sydneyToday } from "@/lib/dates"
import type { Overlay } from "@/lib/stats"
import { useUpdateSuburb } from "@/mutations/use-update-suburb"
import { useMySuburbs } from "@/queries/my-suburbs"
import type { SuburbProperties } from "@/types/suburb"
import type { UserSuburb } from "@/types/user-suburb"

const NOTES_DEBOUNCE_MS = 600
const NOTES_MAX_LENGTH = 10_000

export type Suburb = Pick<SuburbProperties, "id" | "name" | "lga">

export interface SuburbPanelProps {
  // Undefined when nothing is selected.
  suburb: Suburb | undefined
  signedIn: boolean
  onClose: () => void
  // Outlines the council on the map, like the progress list does.
  onZoomToCouncil: (lga: string) => void
  // What the map is showing from the panel, if anything.
  overlay: Overlay | undefined
  onToggleOverlay: (overlay: Overlay) => void
}

interface CouncilButtonProps {
  lga: string
  onZoom: (lga: string) => void
}

export function CouncilButton(props: CouncilButtonProps) {
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

export function CloseButton(props: CloseButtonProps) {
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
}

// Keyed on the suburb, so the form and its unsaved notes start fresh for each.
export function PanelBody(props: PanelBodyProps) {
  const [rows] = useMySuburbs()
  const login = () =>
    `/login?redirect=${encodeURIComponent(`/?suburb=${props.suburbId}`)}`
  return (
    <Loading
      fallback={<p class="text-sm text-muted-foreground">Loading&hellip;</p>}
    >
      <Show
        fallback={
          <a class={buttonVariants({ variant: "outline" })} href={login()}>
            Sign in to track your visits
          </a>
        }
        when={props.signedIn}
      >
        <Show keyed when={props.suburbId}>
          {(suburbId) => (
            <VisitForm
              row={rows.find((row) => row.suburbId === suburbId)}
              suburbId={suburbId}
            />
          )}
        </Show>
      </Show>
    </Loading>
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
