import ArrowDownIcon from "@lucide/solid/icons/arrow-down"
import ArrowUpIcon from "@lucide/solid/icons/arrow-up"
import EllipsisIcon from "@lucide/solid/icons/ellipsis"
import { createSignal, createUniqueId, For, Show } from "solid-js"

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
  // Null stops editing the active region.
  onActivate: (id: string | null) => void
}

// The custom map's controls: name the selected suburbs as a region, edit the
// saved regions, and export the map.
export function RegionsPanel(props: RegionsPanelProps) {
  const titleId = createUniqueId()
  const regions = () => props.custom.map().regions

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
      <Show
        fallback={
          <DraftForm custom={props.custom} onCreated={props.onActivate} />
        }
        when={props.custom.active()}
      >
        {(region) => (
          <div class="flex items-center justify-between gap-2 rounded-lg bg-muted px-2 py-1.5 text-sm">
            <span class="min-w-0">
              Click suburbs to add them to or remove them from{" "}
              <strong class="font-semibold">{region().name}</strong>
            </span>
            <Button
              onClick={() => {
                props.onActivate(null)
              }}
              size="sm"
              variant="outline"
            >
              Done
            </Button>
          </div>
        )}
      </Show>
      <CouncilPicker
        onPick={(ids) => {
          props.custom.addMany(ids)
        }}
        suburbs={props.suburbs}
      />
      <Show when={regions().length > 0}>
        <ul aria-label="Regions" class="-mx-1 flex flex-col">
          <For each={regions()} keyed={(r) => r.id}>
            {(region, index) => (
              <RegionRow
                active={props.custom.active()?.id === region().id}
                custom={props.custom}
                first={index() === 0}
                last={index() === regions().length - 1}
                onActivate={props.onActivate}
                region={region()}
              />
            )}
          </For>
        </ul>
      </Show>
      <ExportMenu data={props.data} map={props.custom.map()} />
    </section>
  )
}

interface DraftFormProps {
  custom: CustomMap
  onCreated: (id: string) => void
}

// Names the selected suburbs. The colour defaults to the next unused one.
function DraftForm(props: DraftFormProps) {
  const [name, setName] = createSignal("")
  const nameId = createUniqueId()
  const count = () => props.custom.selection().size

  return (
    <Show
      fallback={
        <p class="text-sm text-muted-foreground">
          Click suburbs, or add a council, then name the group.
        </p>
      }
      when={count() > 0}
    >
      <form
        aria-label="New region"
        class="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          const id = props.custom.createRegion(name())
          setName("")
          props.onCreated(id)
        }}
      >
        <div class="flex items-center justify-between text-sm">
          <span>
            {count()} {count() === 1 ? "suburb" : "suburbs"} selected
          </span>
          <Button
            onClick={() => {
              props.custom.clearSelection()
            }}
            size="xs"
            variant="ghost"
          >
            Clear
          </Button>
        </div>
        <div class="flex items-center gap-2">
          <ColorPicker
            color={props.custom.draftColor()}
            label="the new region"
            onChange={props.custom.setDraftColor}
          />
          <label class="sr-only" for={nameId}>
            Region name
          </label>
          <Input
            id={nameId}
            maxlength={REGION_NAME_MAX}
            onInput={(event) => {
              setName(event.currentTarget.value)
            }}
            placeholder={props.custom.draftName()}
            value={name()}
          />
          <Button type="submit">Create</Button>
        </div>
      </form>
    </Show>
  )
}

interface RegionRowProps {
  region: Region
  active: boolean
  first: boolean
  last: boolean
  custom: CustomMap
  onActivate: (id: string | null) => void
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
      <button
        aria-pressed={props.active ? "true" : "false"}
        class="flex min-w-0 flex-1 items-baseline justify-between gap-2 rounded-sm text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        onClick={() => {
          props.onActivate(props.active ? null : props.region.id)
        }}
        type="button"
      >
        <span class="truncate">{props.region.name}</span>
        <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
          {count()}
        </span>
      </button>
      <RegionMenu {...props} />
    </li>
  )
}

// Rename, reorder and delete. Deleting a region with suburbs asks first.
function RegionMenu(props: RegionRowProps) {
  const [open, setOpen] = createSignal(false)
  const [confirming, setConfirming] = createSignal(false)
  const nameId = createUniqueId()
  const id = () => props.region.id

  const remove = () => {
    if (props.region.suburbIds.length > 0 && !confirming()) {
      setConfirming(true)

      return
    }

    setOpen(false)

    if (props.active) {
      props.onActivate(null)
    }

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
      <PopoverContent align="end" class="w-60">
        <label class="sr-only" for={nameId}>
          Name
        </label>
        <Input
          id={nameId}
          maxlength={REGION_NAME_MAX}
          // Blank names are ignored, so clearing the field keeps the old one.
          onInput={(event) => {
            props.custom.dispatch({
              type: "renameRegion",
              id: id(),
              name: event.currentTarget.value,
            })
          }}
          value={props.region.name}
        />
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
