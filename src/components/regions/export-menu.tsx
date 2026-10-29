import DownloadIcon from "@lucide/solid/icons/download"
import { createSignal, Show } from "solid-js"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import type { Framing } from "@/lib/export-png"
import type { RegionMap } from "@/lib/regions"
import type { SuburbMapData } from "@/types/suburb"

interface ExportMenuProps {
  data: SuburbMapData
  map: RegionMap
}

// Downloads the map as a PNG, framed on the regions or on all of Sydney.
export function ExportMenu(props: ExportMenuProps) {
  const [open, setOpen] = createSignal(false)
  const [framing, setFraming] = createSignal<Framing>("regions")
  const [suburbNames, setSuburbNames] = createSignal(false)
  const [exporting, setExporting] = createSignal(false)
  const [error, setError] = createSignal<string | null>(null)
  const hasRegions = () => props.map.regions.some((r) => r.suburbIds.length > 0)
  // With nothing to frame, only all of Sydney is on offer.
  const frame = (): Framing => (hasRegions() ? framing() : "all")

  async function download() {
    setExporting(true)
    setError(null)

    try {
      const { downloadPng } = await import("@/lib/export-png")
      await downloadPng(props.data, props.map, {
        framing: frame(),
        suburbNames: suburbNames(),
      })
      setOpen(false)
    } catch {
      setError(
        "The image couldn't be made. Try again, or frame a smaller area.",
      )
    } finally {
      setExporting(false)
    }
  }

  return (
    <Popover onOpenChange={setOpen} open={open()}>
      <PopoverTrigger
        render={(triggerProps) => (
          <Button {...triggerProps} class="self-start" variant="outline" />
        )}
      >
        <DownloadIcon data-icon="inline-start" />
        Export PNG
      </PopoverTrigger>
      <PopoverContent align="start" class="w-64">
        <fieldset class="flex flex-col gap-1.5">
          <legend class="mb-1 text-xs text-muted-foreground">Frame</legend>
          <label class="flex items-center gap-2">
            <input
              checked={frame() === "regions"}
              disabled={!hasRegions()}
              name="framing"
              onChange={() => setFraming("regions")}
              type="radio"
            />
            The regions
          </label>
          <label class="flex items-center gap-2">
            <input
              checked={frame() === "all"}
              name="framing"
              onChange={() => setFraming("all")}
              type="radio"
            />
            All of Sydney
          </label>
        </fieldset>
        <label class="flex items-center gap-2">
          <input
            checked={suburbNames()}
            onChange={(event) => setSuburbNames(event.currentTarget.checked)}
            type="checkbox"
          />
          Include suburb names
        </label>
        <Button disabled={exporting()} onClick={download}>
          {exporting() ? "Exporting…" : "Download"}
        </Button>
        <Show when={error()}>
          {(message) => (
            <p class="text-xs text-destructive" role="alert">
              {message()}
            </p>
          )}
        </Show>
      </PopoverContent>
    </Popover>
  )
}
