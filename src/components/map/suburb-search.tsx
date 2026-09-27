import { SearchIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import { buildIndex, normalise, search } from "@/lib/search"
import type { SuburbProperties } from "@/types/suburb"

type Suburb = Pick<SuburbProperties, "id" | "name" | "lga">

interface SuburbSearchProps {
  suburbs: readonly Suburb[]
  visitedIds: ReadonlySet<string>
  onPick: (id: string) => void
}

// Finds suburbs by name. "/" focuses it from anywhere outside a text field.
export function SuburbSearch({
  suburbs,
  visitedIds,
  onPick,
}: SuburbSearchProps) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const index = buildIndex(suburbs, (s) => s.name)
  const results = search(index, query)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const { target } = event
      const typing =
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLInputElement
      if (event.key === "/" && !typing) {
        event.preventDefault()
        input.current?.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return (
    <div className="rounded-lg bg-background shadow-sm">
      <Combobox<Suburb | null>
        filter={null}
        inputRef={input}
        inputValue={query}
        itemToStringLabel={(s) => s?.name ?? ""}
        items={results}
        onInputValueChange={setQuery}
        onOpenChange={setOpen}
        onValueChange={(suburb) => {
          if (suburb) {
            setQuery("")
            onPick(suburb.id)
          }
        }}
        // Nothing to show until there's something to search for.
        open={open && normalise(query) !== ""}
        value={null}
      >
        <ComboboxInput
          aria-label="Search suburbs"
          placeholder="Search suburbs"
          showTrigger={false}
        >
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>
            No suburb called &ldquo;{query.trim()}&rdquo; in the map area.
          </ComboboxEmpty>
          <ComboboxList>
            {(suburb: Suburb) => (
              <ComboboxItem key={suburb.id} value={suburb}>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate">{suburb.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {suburb.lga}
                  </span>
                </span>
                {visitedIds.has(suburb.id) ? (
                  <>
                    <span
                      aria-hidden
                      className="size-2 rounded-full bg-map-visited"
                    />
                    <span className="sr-only">, visited</span>
                  </>
                ) : null}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
