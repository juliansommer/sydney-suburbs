import { onSettled } from "solid-js"

// Calls `onPress` when `key` is pressed anywhere outside a text field.
export function useShortcut(
  key: string,
  onPress: (event: KeyboardEvent) => void,
) {
  const onKeyDown = (event: KeyboardEvent) => {
    const { target } = event

    const typing =
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLInputElement

    if (event.key === key && !typing) {
      onPress(event)
    }
  }

  onSettled(() => {
    document.addEventListener("keydown", onKeyDown)

    return () => {
      document.removeEventListener("keydown", onKeyDown)
    }
  })
}
