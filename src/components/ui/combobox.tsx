import type { JSX } from "@solidjs/web"
import { Combobox as ComboboxPrimitive } from "base-ui-solid/combobox"
import { omit } from "solid-js"

import { CheckIcon } from "@/components/icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"
import { cn } from "@/lib/utils"

const Combobox = ComboboxPrimitive.Root

type ComboboxInputProps = Omit<ComboboxPrimitive.Input.Props, "class"> & {
  class?: JSX.ClassValue
}

function ComboboxInput(props: ComboboxInputProps) {
  const rest = omit(props, "class", "children")
  return (
    <InputGroup class={cn("w-auto", props.class)}>
      <ComboboxPrimitive.Input
        render={(inputProps) => <InputGroupInput {...inputProps} />}
        {...rest}
      />
      <InputGroupAddon align="inline-end" />
      {props.children}
    </InputGroup>
  )
}

type ComboboxContentProps = Omit<ComboboxPrimitive.Popup.Props, "class"> &
  Pick<
    ComboboxPrimitive.Positioner.Props,
    "side" | "align" | "sideOffset" | "alignOffset"
  > & { class?: JSX.ClassValue }

function ComboboxContent(props: ComboboxContentProps) {
  const rest = omit(
    props,
    "class",
    "side",
    "align",
    "sideOffset",
    "alignOffset",
  )
  return (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        side={props.side ?? "bottom"}
        sideOffset={props.sideOffset ?? 6}
        align={props.align ?? "start"}
        alignOffset={props.alignOffset ?? 0}
        class="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-slot="combobox-content"
          class={cn(
            "group/combobox-content relative max-h-(--available-height) w-(--anchor-width) max-w-(--available-width) min-w-[calc(var(--anchor-width)+--spacing(7))] origin-(--transform-origin) overflow-hidden rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 *:data-[slot=input-group]:m-1 *:data-[slot=input-group]:mb-0 *:data-[slot=input-group]:h-8 *:data-[slot=input-group]:border-input/30 *:data-[slot=input-group]:bg-input/30 *:data-[slot=input-group]:shadow-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            props.class,
          )}
          {...rest}
        />
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  )
}

function ComboboxList<Item>(props: ComboboxPrimitive.List.Props<Item>) {
  return (
    <ComboboxPrimitive.List<Item>
      data-slot="combobox-list"
      class="no-scrollbar max-h-[min(calc(--spacing(72)---spacing(9)),calc(var(--available-height)---spacing(9)))] scroll-py-1 overflow-y-auto overscroll-contain p-1 data-empty:p-0"
      {...props}
    />
  )
}

function ComboboxItem(props: ComboboxPrimitive.Item.Props) {
  const rest = omit(props, "children")
  return (
    <ComboboxPrimitive.Item
      data-slot="combobox-item"
      class="relative flex w-full cursor-default items-center gap-2 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none data-highlighted:bg-accent data-highlighted:text-accent-foreground not-data-[variant=destructive]:data-highlighted:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
      {...rest}
    >
      {props.children}
      <ComboboxPrimitive.ItemIndicator
        class="pointer-events-none absolute right-2 flex size-4 items-center justify-center"
        render="span"
      >
        <CheckIcon class="pointer-events-none" />
      </ComboboxPrimitive.ItemIndicator>
    </ComboboxPrimitive.Item>
  )
}

function ComboboxEmpty(props: ComboboxPrimitive.Empty.Props) {
  return (
    <ComboboxPrimitive.Empty
      data-slot="combobox-empty"
      class="hidden w-full justify-center py-2 text-center text-sm text-muted-foreground group-data-empty/combobox-content:flex"
      {...props}
    />
  )
}

export {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
}
