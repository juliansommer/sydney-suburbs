import { useEffect, useEffectEvent } from "react"

// Calls `onPress` when `key` is pressed anywhere outside a text field.
export function useShortcut(
  key: string,
  onPress: (event: KeyboardEvent) => void,
) {
  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    const { target } = event
    const typing =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement
    if (event.key === key && !typing) {
      onPress(event)
    }
  })
  useEffect(() => {
    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  }, [])
}
