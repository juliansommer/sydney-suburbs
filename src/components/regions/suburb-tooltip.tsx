import { Show } from "solid-js"

import type { SuburbHover } from "@/components/map/suburb-map"

// Space between the pointer and the tooltip, so it doesn't sit under it.
const POINTER_OFFSET = 14

interface SuburbTooltipProps {
  hover: SuburbHover | null
  name: (id: string) => string | undefined
  region: (id: string) => string | undefined
}

// The fills hide which suburb is which when zoomed out, so hovering names it
// and its region.
export function SuburbTooltip(props: SuburbTooltipProps) {
  return (
    <Show when={props.hover}>
      {(hover) => (
        <div
          class="pointer-events-none fixed top-0 left-0 z-40 translate-x-(--x) translate-y-(--y) rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
          role="tooltip"
          style={{
            "--x": `${hover().x + POINTER_OFFSET}px`,
            "--y": `${hover().y + POINTER_OFFSET}px`,
          }}
        >
          <span class="font-medium">{props.name(hover().id)}</span>
          <Show when={props.region(hover().id)}>
            {(region) => (
              <span class="text-muted-foreground"> &middot; {region()}</span>
            )}
          </Show>
        </div>
      )}
    </Show>
  )
}
