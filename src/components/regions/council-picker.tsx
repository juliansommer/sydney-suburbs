import { createMemo, createSignal } from "solid-js"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { buildIndex, search } from "@/lib/search"
import type { SuburbProperties } from "@/types/suburb"

interface Council {
  lga: string
  ids: string[]
}

interface CouncilPickerProps {
  suburbs: readonly SuburbProperties[]
  onPick: (suburbIds: string[]) => void
}

export function councilsOf(suburbs: readonly SuburbProperties[]): Council[] {
  const byLga = new Map<string, string[]>()

  for (const s of suburbs) {
    const ids = byLga.get(s.lga)

    if (ids) {
      ids.push(s.id)
    } else {
      byLga.set(s.lga, [s.id])
    }
  }

  return [...byLga]
    .map(([lga, ids]) => ({ lga, ids }))
    .toSorted((a, b) => a.lga.localeCompare(b.lga))
}

// Adds every suburb in a council in one step.
export function CouncilPicker(props: CouncilPickerProps) {
  const [query, setQuery] = createSignal("")
  const councils = createMemo(() => councilsOf(props.suburbs))
  const index = createMemo(() => buildIndex(councils(), (c) => c.lga))

  // Empty, the list shows every council, to browse.
  const results = createMemo(() =>
    query().trim() === "" ? councils() : search(index(), query()),
  )

  return (
    <Combobox<Council | null>
      filter={null}
      inputValue={query()}
      itemToStringLabel={(c) => c?.lga ?? ""}
      items={results()}
      onInputValueChange={setQuery}
      onValueChange={(council) => {
        if (council) {
          setQuery("")
          props.onPick(council.ids)
        }
      }}
      value={null}
    >
      <ComboboxInput aria-label="Add a council" placeholder="Add a council" />
      <ComboboxContent>
        <ComboboxEmpty>
          No council called &ldquo;{query().trim()}&rdquo;.
        </ComboboxEmpty>
        <ComboboxList<Council>>
          {(council) => (
            <ComboboxItem value={council()}>
              <span class="flex min-w-0 flex-1 justify-between gap-2">
                <span class="truncate">{council().lga}</span>
                <span class="text-xs text-muted-foreground tabular-nums">
                  {council().ids.length}
                </span>
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}
