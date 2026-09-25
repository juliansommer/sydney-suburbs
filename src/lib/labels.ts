// Rough average glyph width of the UI font, as a fraction of font size.
const CHAR_WIDTH = 0.55

interface Box {
  width: number
  height: number
}

// A label shows once its suburb, scaled by the zoom factor `k`, is wide and
// tall enough to hold the text at `fontSize` screen pixels.
export function labelFits(box: Box, k: number, name: string, fontSize: number) {
  return (
    box.width * k >= name.length * CHAR_WIDTH * fontSize &&
    box.height * k >= fontSize
  )
}
