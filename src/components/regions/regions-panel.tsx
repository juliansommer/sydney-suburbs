import ArrowDownIcon from "@lucide/solid/icons/arrow-down"
import ArrowUpIcon from "@lucide/solid/icons/arrow-up"
import EllipsisIcon from "@lucide/solid/icons/ellipsis"
import PlusIcon from "@lucide/solid/icons/plus"
import {
  createSignal,
  createUniqueId,
  For,
  onSettled,
  Show,
  untrack,
} from "solid-js"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { CustomMap } from "@/hooks/use-custom-map"
import { type Region, REGION_NAME_MAX, TITLE_MAX } from "@/lib/regions"
import { cn } from "@/lib/utils"
import type { SuburbMapData, SuburbProperties } from "@/types/suburb"

import { ColorPicker } from "./color-picker"
import { CouncilPicker } from "./council-picker"
import { ExportMenu } from "./export-menu"

interface RegionsPanelProps {
  custom: CustomMap
  data: SuburbMapData
  suburbs: readonly SuburbProperties[]
  onActivate: (id: string) => void
}

// The custom map's controls: the regions, with the one clicks add to picked
// out, a council picker, and the export.
export function RegionsPanel(props: RegionsPanelProps) {
  const titleId = createUniqueId()
  const regions = () => props.custom.map().regions
  // Only a region made with the + button takes focus, to type its name.
  const [focusId, setFocusId] = createSignal<string | null>(null)

  return (
    <section
      aria-label="Custom map"
      class="flex max-h-[60dvh] w-full flex-col gap-3 overflow-y-auto rounded-xl border bg-card p-3 text-card-foreground shadow-lg md:w-72"
    >
      <div class="flex flex-col gap-1">
        <label class="text-xs text-muted-foreground" for={titleId}>
          Map title
        </label>
        <Input
          id={titleId}
          maxlength={TITLE_MAX}
          onInput={(event) => {
            props.custom.dispatch({
              type: "setTitle",
              title: event.currentTarget.value,
            })
          }}
          value={props.custom.map().title}
        />
      </div>
      <div class="flex flex-col gap-1">
        <div class="flex items-center justify-between">
          <h2 class="text-xs text-muted-foreground">Regions</h2>
          <Button
            aria-label="New region"
            onClick={() => {
              setFocusId(props.custom.addRegion())
            }}
            size="icon-xs"
            variant="outline"
          >
            <PlusIcon />
          </Button>
        </div>
        <Show
          fallback={
            <p class="text-sm text-muted-foreground">
              Press + or click a suburb to start a region.
            </p>
          }
          when={regions().length > 0}
        >
          <ul aria-label="Regions" class="-mx-1 flex flex-col">
            <For each={regions()} keyed={(r) => r.id}>
              {(region, index) => (
                <RegionRow
                  active={props.custom.active()?.id === region().id}
                  custom={props.custom}
                  first={index() === 0}
                  focus={focusId() === region().id}
                  last={index() === regions().length - 1}
                  onActivate={props.onActivate}
                  region={region()}
                />
              )}
            </For>
          </ul>
        </Show>
      </div>
      <Show when={props.custom.active()}>
        {(region) => (
          <p class="text-sm text-muted-foreground">
            Click suburbs to add them to{" "}
            <strong class="font-semibold text-foreground">
              {region().name}
            </strong>
            , or again to take them out.
          </p>
        )}
      </Show>
      <CouncilPicker
        onPick={(ids) => {
          props.custom.addMany(ids)
        }}
        suburbs={props.suburbs}
      />
      <ExportMenu data={props.data} map={props.custom.map()} />
    </section>
  )
}

interface RegionRowProps {
  region: Region
  active: boolean
  // Focuses the name, selected, to type over the default.
  focus: boolean
  first: boolean
  last: boolean
  custom: CustomMap
  onActivate: (id: string) => void
}

function RegionRow(props: RegionRowProps) {
  const count = () => props.region.suburbIds.length

  return (
    <li
      class={cn(
        "flex items-center gap-2 rounded-md px-1 py-1",
        props.active && "bg-muted",
      )}
    >
      <ColorPicker
        color={props.region.color}
        label={props.region.name}
        onChange={(color) => {
          props.custom.dispatch({
            type: "recolorRegion",
            id: props.region.id,
            color,
          })
        }}
      />
      <Show
        fallback={
          <button
            aria-label={`Add to ${props.region.name}`}
            class="h-7 min-w-0 flex-1 truncate rounded-sm px-2 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            onClick={() => {
              props.onActivate(props.region.id)
            }}
            type="button"
          >
            {props.region.name}
          </button>
        }
        when={props.active}
      >
        <RegionName {...props} />
      </Show>
      <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
        {/* As text: a count that starts at 0 fails to update as a number. */}
        {String(count())}
      </span>
      <RegionMenu {...props} />
    </li>
  )
}

// The region being added to is renamed in place. The field keeps its own
// text, so it can be cleared to retype; a blank name isn't saved, and is put
// back when the field loses focus.
function RegionName(props: RegionRowProps) {
  const [text, setText] = createSignal(untrack(() => props.region.name))
  let input: HTMLElement | undefined

  onSettled(() => {
    if (props.focus && input instanceof HTMLInputElement) {
      input.focus()
      input.select()
    }
  })

  return (
    <Input
      aria-label="Region name"
      class="h-7 min-w-0 flex-1"
      maxlength={REGION_NAME_MAX}
      onBlur={() => {
        setText(props.region.name)
      }}
      onInput={(event) => {
        setText(event.currentTarget.value)
        props.custom.dispatch({
          type: "renameRegion",
          id: props.region.id,
          name: event.currentTarget.value,
        })
      }}
      ref={(element) => {
        input = element
      }}
      value={text()}
    />
  )
}

// Reorder and delete. Deleting a region with suburbs asks first.
function RegionMenu(props: RegionRowProps) {
  const [open, setOpen] = createSignal(false)
  const [confirming, setConfirming] = createSignal(false)
  const id = () => props.region.id

  const remove = () => {
    if (props.region.suburbIds.length > 0 && !confirming()) {
      setConfirming(true)

      return
    }

    setOpen(false)
    props.custom.dispatch({ type: "deleteRegion", id: id() })
  }

  return (
    <Popover
      onOpenChange={(next) => {
        setOpen(next)
        setConfirming(false)
      }}
      open={open()}
    >
      <PopoverTrigger
        aria-label={`Edit ${props.region.name}`}
        render={(triggerProps) => (
          <Button {...triggerProps} size="icon-xs" variant="ghost" />
        )}
      >
        <EllipsisIcon />
      </PopoverTrigger>
      <PopoverContent align="end" class="w-64">
        <div class="flex gap-1">
          <Button
            disabled={props.first}
            onClick={() => {
              props.custom.dispatch({ type: "moveRegion", id: id(), by: -1 })
            }}
            size="sm"
            variant="outline"
          >
            <ArrowUpIcon data-icon="inline-start" />
            Up
          </Button>
          <Button
            disabled={props.last}
            onClick={() => {
              props.custom.dispatch({ type: "moveRegion", id: id(), by: 1 })
            }}
            size="sm"
            variant="outline"
          >
            <ArrowDownIcon data-icon="inline-start" />
            Down
          </Button>
          <Button
            class="ml-auto"
            onClick={remove}
            size="sm"
            variant="destructive"
          >
            {confirming() ? "Confirm delete" : "Delete"}
          </Button>
        </div>
        <Show when={confirming()}>
          <p class="text-xs text-muted-foreground">
            This removes {props.region.name} and its{" "}
            {props.region.suburbIds.length} suburbs from the map.
          </p>
        </Show>
      </PopoverContent>
    </Popover>
  )
}
