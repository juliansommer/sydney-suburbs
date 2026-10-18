import { type Accessor, createSignal, onSettled } from "solid-js"

// Whether the media query currently matches, updating as it changes.
export function useMediaQuery(query: string): Accessor<boolean> {
  const list = window.matchMedia(query)
  const [matches, setMatches] = createSignal(list.matches)
  onSettled(() => {
    const onChange = () => {
      setMatches(list.matches)
    }
    list.addEventListener("change", onChange)
    return () => {
      list.removeEventListener("change", onChange)
    }
  })
  return matches
}
