// Flags are SVGs, which Chrome re-rasterises for every suburb on every frame
// of a pan or zoom. A bitmap drawn once halves the frame time.
const RASTER_SIZE = [400, 300] as const

// The image as a PNG data URL, or as given if it can't be drawn.
export async function rasterise(src: string): Promise<string> {
  try {
    const img = new Image()
    img.src = src
    await img.decode()
    const canvas = document.createElement("canvas")
    ;[canvas.width, canvas.height] = RASTER_SIZE
    canvas.getContext("2d")?.drawImage(img, 0, 0, ...RASTER_SIZE)
    return canvas.toDataURL("image/png")
  } catch {
    return src
  }
}
