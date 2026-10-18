import { For } from "solid-js"

import {
  COUNTRIES,
  type CountryColour,
  NO_BIRTHPLACE,
} from "@/data/birthplace-countries"
import { cn } from "@/lib/utils"

// Country key for the birthplace mode, with each country's flag.
export function BirthplaceLegend() {
  return (
    <div class="flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <p class="text-sm font-medium">Top birthplace</p>
      <ul
        aria-label="Birthplace key"
        class="grid grid-cols-2 gap-x-2 gap-y-1 text-xs"
      >
        <For each={COUNTRIES}>
          {(c) => (
            <li class="flex items-center gap-1.5">
              <img
                alt=""
                class="h-3.5 w-5 rounded-xs border object-cover"
                height={15}
                src={c.flag}
                width={20}
              />
              {c.label}
            </li>
          )}
        </For>
        <SwatchItem colour={NO_BIRTHPLACE} />
      </ul>
      <p class="text-xs text-muted-foreground">
        2021 Census, most common country of birth other than Australia
      </p>
    </div>
  )
}

interface SwatchItemProps {
  colour: CountryColour
}

function SwatchItem(props: SwatchItemProps) {
  return (
    <li class="flex items-center gap-1.5 text-muted-foreground">
      <span
        aria-hidden="true"
        class={cn("h-3.5 w-5 shrink-0 rounded-xs border", props.colour.swatch)}
      />
      {props.colour.label}
    </li>
  )
}
