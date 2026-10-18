import { createMemo, createSignal, Show } from "solid-js"

import { SearchIcon } from "@/components/icons"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { InputGroupAddon } from "@/components/ui/input-group"
import { useShortcut } from "@/hooks/use-shortcut"
import { buildIndex, normalise, search } from "@/lib/search"
import type { SuburbProperties } from "@/types/suburb"

type Suburb = Pick<SuburbProperties, "id" | "name" | "lga">

interface SuburbSearchProps {
  suburbs: readonly Suburb[]
  visitedIds: ReadonlySet<string>
  onPick: (id: string) => void
}

// Finds suburbs by name. "/" focuses it from anywhere outside a text field.
export function SuburbSearch(props: SuburbSearchProps) {
  const [query, setQuery] = createSignal("")
  const [open, setOpen] = createSignal(false)
  let input: HTMLInputElement | undefined
  const index = createMemo(() => buildIndex(props.suburbs, (s) => s.name))
  const results = createMemo(() => search(index(), query()))

  useShortcut("/", (event) => {
    event.preventDefault()
    input?.focus()
  })

  return (
    <div class="rounded-lg bg-background shadow-sm">
      <Combobox<Suburb | null>
        filter={null}
        inputRef={(element) => {
          input = element
        }}
        inputValue={query()}
        itemToStringLabel={(s) => s?.name ?? ""}
        items={results()}
        onInputValueChange={setQuery}
        onOpenChange={setOpen}
        onValueChange={(suburb) => {
          if (suburb) {
            setQuery("")
            props.onPick(suburb.id)
          }
        }}
        // Nothing to show until there's something to search for.
        open={open() && normalise(query()) !== ""}
        value={null}
      >
        <ComboboxInput aria-label="Search suburbs" placeholder="Search suburbs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
        </ComboboxInput>
        <ComboboxContent>
          <ComboboxEmpty>
            No suburb called &ldquo;{query().trim()}&rdquo; in the map area.
          </ComboboxEmpty>
          <ComboboxList<Suburb>>
            {(suburb) => (
              <ComboboxItem value={suburb()}>
                <span class="flex min-w-0 flex-1 flex-col">
                  <span class="truncate">{suburb().name}</span>
                  <span class="truncate text-xs text-muted-foreground">
                    {suburb().lga}
                  </span>
                </span>
                <Show when={props.visitedIds.has(suburb().id)}>
                  <span
                    aria-hidden="true"
                    class="size-2 rounded-full bg-map-visited"
                  />
                  <span class="sr-only">, visited</span>
                </Show>
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </div>
  )
}
