import type { JSX } from "@solidjs/web"
import { createSignal, For, omit } from "solid-js"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { REGION_PALETTE } from "@/lib/regions"
import { cn } from "@/lib/utils"

interface ColorPickerProps {
  color: string
  // Names what's being coloured, for the trigger's label.
  label: string
  onChange: (color: string) => void
}

// A swatch opening the palette, plus the browser's picker for any colour.
export function ColorPicker(props: ColorPickerProps) {
  const [open, setOpen] = createSignal(false)

  return (
    <Popover onOpenChange={setOpen} open={open()}>
      <PopoverTrigger
        aria-label={`Colour for ${props.label}`}
        render={(triggerProps) => (
          <Swatch {...triggerProps} color={props.color} />
        )}
      />
      <PopoverContent align="start" class="w-auto">
        <div class="grid grid-cols-6 gap-1.5">
          <For each={REGION_PALETTE}>
            {(c) => (
              <Swatch
                aria-label={c}
                aria-pressed={
                  c === props.color.toLowerCase() ? "true" : "false"
                }
                class={cn(
                  "size-7",
                  c === props.color.toLowerCase() &&
                    "ring-2 ring-foreground ring-offset-1 ring-offset-popover",
                )}
                color={c}
                onClick={() => {
                  props.onChange(c)
                  setOpen(false)
                }}
              />
            )}
          </For>
        </div>
        <label class="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          Any colour
          <input
            class="h-7 w-12 cursor-pointer rounded-md border bg-transparent"
            onInput={(event) => {
              props.onChange(event.currentTarget.value)
            }}
            type="color"
            value={props.color}
          />
        </label>
      </PopoverContent>
    </Popover>
  )
}

type SwatchProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "color"
> & {
  color: string
}

// Coloured through a custom property, since the colour is picked at runtime.
function Swatch(props: SwatchProps) {
  const rest = omit(props, "class", "color")

  return (
    <button
      type="button"
      {...rest}
      class={cn(
        "size-6 shrink-0 rounded-md border bg-swatch shadow-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        props.class,
      )}
      style={{ "--swatch": props.color }}
    />
  )
}
