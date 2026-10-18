import { SearchIcon } from "lucide-react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

// Stands in for the search box while its chunk loads, built the same way so
// nothing shifts when the real one swaps in.
export function SearchPlaceholder() {
  return (
    <div className="rounded-lg bg-background shadow-sm">
      <InputGroup className="w-auto">
        <InputGroupInput
          aria-label="Search suburbs"
          placeholder="Search suburbs"
          readOnly
        />
        <InputGroupAddon align="inline-end" />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
