import { createMemo, createSignal, For } from "solid-js"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { councilProgress } from "@/lib/progress"

interface CouncilProgressProps {
  suburbs: readonly { id: string; lga: string }[]
  visitedIds: ReadonlySet<string>
  onZoom: (lga: string) => void
}

// The "N / 648 suburbs" counter, opening a per-council breakdown. Picking a
// council zooms the map to it.
export function CouncilProgressButton(props: CouncilProgressProps) {
  const [open, setOpen] = createSignal(false)

  const councils = createMemo(() =>
    councilProgress(props.suburbs, props.visitedIds),
  )

  const visited = () => councils().reduce((sum, c) => sum + c.visited, 0)

  return (
    <Popover onOpenChange={setOpen} open={open()}>
      <PopoverTrigger
        aria-label={`${visited()} of ${props.suburbs.length} suburbs visited`}
        render={(triggerProps) => <Button {...triggerProps} variant="ghost" />}
      >
        {visited()} / {props.suburbs.length}
        <span class="hidden md:inline">suburbs</span>
      </PopoverTrigger>
      <PopoverContent align="end">
        <ul class="-m-1 flex max-h-96 flex-col overflow-y-auto">
          <For each={councils()} keyed={(c) => c.lga}>
            {(c) => (
              // The button's ::after covers the whole row, bar included.
              <li class="relative flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-muted has-focus-visible:bg-muted">
                <button
                  class="flex w-full justify-between gap-2 text-left outline-none after:absolute after:inset-0"
                  onClick={() => {
                    setOpen(false)
                    props.onZoom(c().lga)
                  }}
                  type="button"
                >
                  <span class="truncate">{c().lga}</span>
                  <span class="text-muted-foreground tabular-nums">
                    {c().visited} / {c().total}
                  </span>
                </button>
                <Progress
                  aria-label={`${c().lga} visited`}
                  max={c().total}
                  value={c().visited}
                  variant="visited"
                />
              </li>
            )}
          </For>
        </ul>
      </PopoverContent>
    </Popover>
  )
}
