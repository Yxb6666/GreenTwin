import type L from 'leaflet'

export type TownshipVisualState = 'normal' | 'hover' | 'selected' | 'dimmed'

export const TOWNSHIP_NORMAL_STYLE: L.PathOptions = {
  pane: 'townshipOverlayPane',
  fillColor: '#3ead82',
  fillOpacity: 0.1,
  color: '#c7df78',
  weight: 1.3,
  opacity: 0.75,
}

const TOWNSHIP_HOVER_STYLE: L.PathOptions = {
  fillColor: '#36d6b0',
  fillOpacity: 0.22,
  color: '#e5f59a',
  weight: 2.5,
  opacity: 1,
}

const TOWNSHIP_SELECTED_STYLE: L.PathOptions = {
  fillOpacity: 0.12,
  color: '#edf6cb',
  weight: 3.5,
  opacity: 1,
}

const TOWNSHIP_DIMMED_STYLE: L.PathOptions = {
  fillColor: '#031b18',
  fillOpacity: 0.48,
  color: '#71877a',
  weight: 1,
  opacity: 0.3,
}

export function resolveTownshipVisualState(
  name: string,
  selectedTownship: string | null,
  hoveredTownship: string | null,
): TownshipVisualState {
  if (selectedTownship) return selectedTownship === name ? 'selected' : 'dimmed'
  return hoveredTownship === name ? 'hover' : 'normal'
}

export function getTownshipPathStyle(
  state: TownshipVisualState,
  baseStyle: L.PathOptions = TOWNSHIP_NORMAL_STYLE,
): L.PathOptions {
  if (state === 'normal') return { ...baseStyle }
  if (state === 'hover') return { ...baseStyle, ...TOWNSHIP_HOVER_STYLE }
  if (state === 'dimmed') return { ...baseStyle, ...TOWNSHIP_DIMMED_STYLE }

  return {
    ...baseStyle,
    ...TOWNSHIP_SELECTED_STYLE,
    fillColor: baseStyle.fillColor,
  }
}

export function getTownshipLabelOpacity(state: TownshipVisualState) {
  return state === 'dimmed' ? 0.3 : 1
}
