import L from 'leaflet'
import type { GovernanceIssue } from './data'

export interface GovernanceHeatPoint {
  latitude: number
  longitude: number
  intensity: number
}

export const GOVERNANCE_HEAT_PANE_Z_INDEX = 620

interface GovernanceHeatLayerState {
  _canvas?: HTMLCanvasElement
  _heatMap?: L.Map
  _points: readonly GovernanceHeatPoint[]
  _draw: () => void
}

export function governanceHeatWeight(issue: GovernanceIssue) {
  const urgencyWeight = issue.urgency === '高' ? 1 : issue.urgency === '中' ? 0.76 : 0.52
  const statusWeight = issue.status === '已办结' ? 0.72 : 1
  return urgencyWeight * statusWeight
}

export function buildGovernanceHeatPoints(issues: readonly GovernanceIssue[]) {
  return issues.map((issue) => ({
    latitude: issue.latitude,
    longitude: issue.longitude,
    intensity: governanceHeatWeight(issue),
  }))
}

function createPalette() {
  const paletteCanvas = document.createElement('canvas')
  paletteCanvas.width = 1
  paletteCanvas.height = 256
  const context = paletteCanvas.getContext('2d')
  if (!context) return null

  const gradient = context.createLinearGradient(0, 0, 0, 256)
  gradient.addColorStop(0, '#2b6cff')
  gradient.addColorStop(0.28, '#19d3c5')
  gradient.addColorStop(0.52, '#7bdd65')
  gradient.addColorStop(0.73, '#ffe45c')
  gradient.addColorStop(0.88, '#ff963f')
  gradient.addColorStop(1, '#f04444')
  context.fillStyle = gradient
  context.fillRect(0, 0, 1, 256)
  return context.getImageData(0, 0, 1, 256).data
}

const GovernanceHeatLayerClass = L.Layer.extend({
  initialize(points: readonly GovernanceHeatPoint[]) {
    const layer = this as unknown as GovernanceHeatLayerState
    layer._points = points
  },
  onAdd(mapInstance: L.Map) {
    const layer = this as unknown as GovernanceHeatLayerState
    const pane = mapInstance.getPane('governanceHeatPane') ?? mapInstance.createPane('governanceHeatPane')
    pane.style.zIndex = String(GOVERNANCE_HEAT_PANE_Z_INDEX)

    const canvas = L.DomUtil.create('canvas', 'governance-heatmap-canvas leaflet-zoom-animated') as HTMLCanvasElement
    canvas.style.pointerEvents = 'none'
    pane.appendChild(canvas)
    layer._heatMap = mapInstance
    layer._canvas = canvas
    mapInstance.on('moveend zoomend resize viewreset', layer._draw, layer)
    layer._draw()
  },
  onRemove(mapInstance: L.Map) {
    const layer = this as unknown as GovernanceHeatLayerState
    if (layer._canvas?.parentElement) layer._canvas.parentElement.removeChild(layer._canvas)
    mapInstance.off('moveend zoomend resize viewreset', layer._draw, layer)
    layer._canvas = undefined
    layer._heatMap = undefined
  },
  _draw() {
    const layer = this as unknown as GovernanceHeatLayerState
    const mapInstance = layer._heatMap
    const canvas = layer._canvas
    if (!mapInstance || !canvas) return

    const size = mapInstance.getSize()
    const pixelRatio = window.devicePixelRatio || 1
    const topLeft = mapInstance.containerPointToLayerPoint([0, 0])
    L.DomUtil.setPosition(canvas, topLeft)
    canvas.width = size.x * pixelRatio
    canvas.height = size.y * pixelRatio
    canvas.style.width = `${size.x}px`
    canvas.style.height = `${size.y}px`

    const context = canvas.getContext('2d')
    const palette = createPalette()
    if (!context || !palette) return
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    context.clearRect(0, 0, size.x, size.y)

    const radius = Math.max(24, Math.min(44, 25 + (mapInstance.getZoom() - 9) * 4))
    const bounds = mapInstance.getBounds().pad(0.12)
    layer._points.forEach((point) => {
      const latLng = L.latLng(point.latitude, point.longitude)
      if (!bounds.contains(latLng)) return
      const position = mapInstance.latLngToContainerPoint(latLng)
      const gradient = context.createRadialGradient(position.x, position.y, 0, position.x, position.y, radius)
      gradient.addColorStop(0, `rgba(0, 0, 0, ${point.intensity})`)
      gradient.addColorStop(0.45, `rgba(0, 0, 0, ${point.intensity * 0.62})`)
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)')
      context.fillStyle = gradient
      context.fillRect(position.x - radius, position.y - radius, radius * 2, radius * 2)
    })

    const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
    for (let index = 0; index < pixels.data.length; index += 4) {
      const alpha = pixels.data[index + 3]
      if (!alpha) continue
      const paletteIndex = Math.min(255, alpha) * 4
      pixels.data[index] = palette[paletteIndex]!
      pixels.data[index + 1] = palette[paletteIndex + 1]!
      pixels.data[index + 2] = palette[paletteIndex + 2]!
      pixels.data[index + 3] = Math.min(225, Math.round(alpha * 1.2))
    }
    context.putImageData(pixels, 0, 0)
  },
})

export function createGovernanceHeatLayer(issues: readonly GovernanceIssue[]) {
  const Constructor = GovernanceHeatLayerClass as unknown as new (points: readonly GovernanceHeatPoint[]) => L.Layer
  return new Constructor(buildGovernanceHeatPoints(issues))
}
