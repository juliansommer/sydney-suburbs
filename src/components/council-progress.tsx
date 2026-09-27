import { useMemo, useState } from "react"

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
  onZoom: (ids: readonly string[]) => void
}

// The "N / 648 suburbs" counter, opening a per-council breakdown. Picking a
// council zooms the map to it.
export function CouncilProgressButton({
  suburbs,
  visitedIds,
  onZoom,
}: CouncilProgressProps) {
  const [open, setOpen] = useState(false)
  const councils = useMemo(
    () => councilProgress(suburbs, visitedIds),
    [suburbs, visitedIds],
  )
  const visited = councils.reduce((sum, c) => sum + c.visited, 0)

  return (
    <Popover onOpenChange={setOpen} open={open}>
      <PopoverTrigger
        aria-label={`${visited} of ${suburbs.length} suburbs visited`}
        render={<Button variant="ghost" />}
      >
        {visited} / {suburbs.length}
        <span className="hidden md:inline">suburbs</span>
      </PopoverTrigger>
      <PopoverContent align="end">
        <ul className="-m-1 flex max-h-96 flex-col overflow-y-auto">
          {councils.map((c) => (
            // The button's ::after covers the whole row, bar included.
            <li
              className="relative flex flex-col gap-1 rounded-md px-2 py-1.5 hover:bg-muted has-focus-visible:bg-muted"
              key={c.lga}
            >
              <button
                className="flex w-full justify-between gap-2 text-left outline-none after:absolute after:inset-0"
                onClick={() => {
                  setOpen(false)
                  onZoom(c.ids)
                }}
                type="button"
              >
                <span className="truncate">{c.lga}</span>
                <span className="text-muted-foreground tabular-nums">
                  {c.visited} / {c.total}
                </span>
              </button>
              <Progress
                aria-label={`${c.lga} visited`}
                max={c.total}
                value={c.visited}
                variant="visited"
              />
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}
