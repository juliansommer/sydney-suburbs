import {
  COUNTRIES,
  type CountryColour,
  NO_BIRTHPLACE,
  OTHER_COUNTRY,
} from "@/data/birthplace-countries"
import { cn } from "@/lib/utils"

// Country key for the birthplace mode, with each country's flag.
export function BirthplaceLegend() {
  return (
    <div className="flex w-64 flex-col gap-2 rounded-xl border bg-card p-3 text-card-foreground shadow-lg">
      <p className="text-sm font-medium">Top birthplace</p>
      <ul
        aria-label="Birthplace key"
        className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs"
      >
        {COUNTRIES.map((c) => (
          <li className="flex items-center gap-1.5" key={c.key}>
            <img
              alt=""
              className="h-3.5 w-5 rounded-xs border object-cover"
              height={15}
              src={c.flag}
              width={20}
            />
            {c.label}
          </li>
        ))}
        <SwatchItem colour={OTHER_COUNTRY} />
        <SwatchItem colour={NO_BIRTHPLACE} />
      </ul>
      <p className="text-xs text-muted-foreground">
        2021 Census, most common country of birth other than Australia
      </p>
    </div>
  )
}

interface SwatchItemProps {
  colour: CountryColour
}

function SwatchItem({ colour }: SwatchItemProps) {
  return (
    <li className="flex items-center gap-1.5 text-muted-foreground">
      <span
        aria-hidden
        className={cn("h-3.5 w-5 shrink-0 rounded-xs border", colour.swatch)}
      />
      {colour.label}
    </li>
  )
}
