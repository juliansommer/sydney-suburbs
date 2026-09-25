import { Link } from "@tanstack/react-router"
import { XIcon } from "lucide-react"
import { useEffect, useEffectEvent, useRef, useState } from "react"

import { Button, buttonVariants } from "@/components/ui/button"
import { sydneyToday } from "@/lib/dates"
import { useUpdateSuburb } from "@/mutations/use-update-suburb"
import type { SuburbProperties } from "@/types/suburb"
import type { UserSuburb } from "@/types/user-suburb"

const NOTES_DEBOUNCE_MS = 600
const NOTES_MAX_LENGTH = 10_000

interface SuburbPanelProps {
  suburb: Pick<SuburbProperties, "id" | "name" | "lga">
  signedIn: boolean
  // The user's rows, or undefined while they load.
  rows: ReadonlyMap<string, UserSuburb> | undefined
  onClose: () => void
}

// Render with `key={suburb.id}` so the notes start fresh for each suburb.
export function SuburbPanel({
  suburb,
  signedIn,
  rows,
  onClose,
}: SuburbPanelProps) {
  return (
    <section
      aria-label={suburb.name}
      className="absolute inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-xl border bg-card p-4 text-card-foreground shadow-lg md:inset-x-auto md:top-16 md:right-4 md:bottom-auto md:w-80 md:rounded-xl"
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{suburb.name}</h2>
          <p className="text-sm text-muted-foreground">{suburb.lga}</p>
        </div>
        <Button
          aria-label="Close"
          onClick={onClose}
          size="icon-sm"
          variant="ghost"
        >
          <XIcon />
        </Button>
      </header>
      <PanelBody rows={rows} signedIn={signedIn} suburbId={suburb.id} />
    </section>
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
