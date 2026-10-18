import type { JSX } from "@solidjs/web"
import { Popover as PopoverPrimitive } from "base-ui-solid/popover"
import { omit } from "solid-js"

import { cn } from "@/lib/utils"

const Popover = PopoverPrimitive.Root

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

type PopoverContentProps = Omit<PopoverPrimitive.Popup.Props, "class"> &
  Pick<
    PopoverPrimitive.Positioner.Props,
    "align" | "alignOffset" | "side" | "sideOffset"
  > & { class?: JSX.ClassValue }

function PopoverContent(props: PopoverContentProps) {
  const rest = omit(
    props,
    "class",
    "align",
    "alignOffset",
    "side",
    "sideOffset",
  )

  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={props.align ?? "center"}
        alignOffset={props.alignOffset ?? 0}
        side={props.side ?? "bottom"}
        sideOffset={props.sideOffset ?? 4}
        class="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          class={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-2.5 rounded-lg bg-popover p-2.5 text-sm text-popover-foreground shadow-md ring-1 ring-foreground/10 outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            props.class,
          )}
          {...rest}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverContent, PopoverTrigger }
