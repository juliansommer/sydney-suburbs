// Browsers without requestIdleCallback get a short timeout instead.
const FALLBACK_DELAY_MS = 200

// Starts `task` once the browser is idle. Returns a function that cancels it.
// The task handles its own errors.
export function whenIdle(task: () => Promise<void>): () => void {
  const start = () => {
    void task()
  }
  if ("requestIdleCallback" in globalThis) {
    const handle = requestIdleCallback(start)
    return () => {
      cancelIdleCallback(handle)
    }
  }
  const handle = setTimeout(start, FALLBACK_DELAY_MS)
  return () => {
    clearTimeout(handle)
  }
}
