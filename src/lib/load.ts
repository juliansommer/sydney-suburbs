// Tests check failures straight away rather than waiting out the backoff.
const RETRIES = import.meta.env.MODE === "test" ? 0 : 3
const FIRST_DELAY_MS = 1000
const MAX_DELAY_MS = 30_000

async function sleep(ms: number): Promise<void> {
  // oxlint-disable-next-line promise/avoid-new
  await new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

// Tries again after 1s, 2s, then 4s, so a blip doesn't show an error.
export async function retry<T>(
  load: () => Promise<T>,
  attempt = 0,
): Promise<T> {
  try {
    return await load()
  } catch (error) {
    if (attempt >= RETRIES) {
      throw error
    }
    await sleep(Math.min(FIRST_DELAY_MS * 2 ** attempt, MAX_DELAY_MS))
    return await retry(load, attempt + 1)
  }
}

const caches = new Set<Map<string, Promise<unknown>>>()

// Loads each file once per page, for files that only change on deploy. A
// failed load is dropped, so the next read tries again.
export function once<A extends string[], T>(
  load: (...args: A) => Promise<T>,
): (...args: A) => Promise<T> {
  const loads = new Map<string, Promise<T>>()
  caches.add(loads)
  return async (...args) => {
    const key = args.join(",")
    let pending = loads.get(key)
    if (!pending) {
      pending = retry(async () => await load(...args))
      loads.set(key, pending)
    }
    try {
      return await pending
    } catch (error) {
      if (loads.get(key) === pending) {
        loads.delete(key)
      }
      throw error
    }
  }
}

// For tests, so one test's data doesn't carry into the next.
export function clearOnce() {
  for (const loads of caches) {
    loads.clear()
  }
}
