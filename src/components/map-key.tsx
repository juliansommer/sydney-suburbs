import ChevronUpIcon from "@lucide/solid/icons/chevron-up"
import type { JSX } from "@solidjs/web"
import { createSignal, createUniqueId } from "solid-js"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface MapKeyProps {
  children: JSX.Element
  // The small-screen toggle's text.
  label?: string
}

// On small screens the key starts hidden behind a toggle, so it doesn't cover
// the map, and opens across the screen. Wider screens always show it.
export function MapKey(props: MapKeyProps) {
  const [open, setOpen] = createSignal(false)
  const keyId = createUniqueId()

  return (
    <>
      <div
        class={cn("w-full md:block md:w-auto", !open() && "hidden")}
        id={keyId}
      >
        {props.children}
      </div>
      <Button
        aria-controls={keyId}
        aria-expanded={open() ? "true" : "false"}
        class="md:hidden"
        onClick={() => {
          setOpen((o) => !o)
        }}
        size="sm"
        variant="outline"
      >
        {props.label ?? "Key"}
        <ChevronUpIcon
          class={cn("transition-transform", open() && "rotate-180")}
          data-icon="inline-end"
        />
      </Button>
    </>
  )
}
