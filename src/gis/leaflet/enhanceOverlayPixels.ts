const FILL_COLOR = [20, 111, 84] as const
const BOUNDARY_COLOR = [214, 237, 159] as const
const BOUNDARY_ALPHA_THRESHOLD = 128

export function enhanceTownshipOverlayPixels(pixels: Uint8ClampedArray) {
  for (let index = 0; index < pixels.length; index += 4) {
    const sourceAlpha = pixels[index + 3]!
    if (sourceAlpha === 0) continue

    const isBoundary = sourceAlpha >= BOUNDARY_ALPHA_THRESHOLD
    const color = isBoundary ? BOUNDARY_COLOR : FILL_COLOR
    pixels[index] = color[0]
    pixels[index + 1] = color[1]
    pixels[index + 2] = color[2]
    pixels[index + 3] = isBoundary ? Math.max(sourceAlpha, 220) : Math.min(150, Math.round(sourceAlpha * 1.9))
  }

  return pixels
}
