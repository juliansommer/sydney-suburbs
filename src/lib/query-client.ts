import {
  type DefaultOptions,
  QueryClient,
  replaceEqualDeep,
} from "@tanstack/solid-query"

// Solid Query serves data through a store, which proxies every nested object
// and tracks each read. Frozen data is left as is, which the map's 100k-odd
// objects need, and nothing here mutates query data anyway.
function freezeShared<T>(previous: T | undefined, data: T): T {
  // Freezing a primitive just returns it.
  return Object.freeze(replaceEqualDeep(previous, data))
}

export function createQueryClient(queries?: DefaultOptions["queries"]) {
  return new QueryClient({
    defaultOptions: {
      queries: { structuralSharing: freezeShared, ...queries },
    },
  })
}
