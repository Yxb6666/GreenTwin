import type L from 'leaflet'

export type TownshipVisualState = 'normal' | 'hover' | 'selected' | 'dimmed'

export const TOWNSHIP_NORMAL_STYLE: L.PathOptions = {
  pane: 'townshipOverlayPane',
  fillColor: '#2ba57d',
  fillOpacity: 0.05,
  color: '#b9cf65',
  weight: 1.2,
  opacity: 0.76,
}

const TOWNSHIP_HOVER_STYLE: L.PathOptions = {
  fillColor: '#3dd6b4',
  fillOpacity: 0.15,
  color: '#e1f29b',
  weight: 2.4,
  opacity: 1,
}

const TOWNSHIP_SELECTED_STYLE: L.PathOptions = {
  fillOpacity: 0.08,
  color: '#edf6cb',
  weight: 3.2,
  opacity: 1,
}

const TOWNSHIP_DIMMED_STYLE: L.PathOptions = {
  fillColor: '#041b18',
  fillOpacity: 0.24,
  color: '#758e80',
  weight: 1,
  opacity: 0.35,
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
  return state === 'dimmed' ? 0.42 : 1
}
