import SearchIcon from "@lucide/solid/icons/search"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group"

// Stands in for the search box while its chunk loads, built the same way so
// nothing shifts when the real one swaps in.
export function SearchPlaceholder() {
  return (
    <div class="rounded-lg bg-background shadow-sm">
      <InputGroup class="w-auto">
        <InputGroupInput
          aria-label="Search suburbs"
          placeholder="Search suburbs"
          readonly
        />
        <InputGroupAddon align="inline-end" />
        <InputGroupAddon>
          <SearchIcon />
        </InputGroupAddon>
      </InputGroup>
    </div>
  )
}
