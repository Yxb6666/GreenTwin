import type L from "leaflet";
import { GREENTWIN_MAP_COLORS } from "@/features/master/mapThemeColors";

export type TownshipVisualState = "normal" | "hover" | "selected" | "dimmed";

export const TOWNSHIP_NORMAL_STYLE: L.PathOptions = {
  pane: "townshipOverlayPane",
  fillColor: GREENTWIN_MAP_COLORS.admin.baseFill,
  fillOpacity: 0.42,
  color: GREENTWIN_MAP_COLORS.admin.townshipStroke,
  weight: 1.05,
  opacity: 0.76,
};

const TOWNSHIP_HOVER_STYLE: L.PathOptions = {
  fillColor: GREENTWIN_MAP_COLORS.admin.hoverFill,
  fillOpacity: 0.32,
  color: GREENTWIN_MAP_COLORS.admin.hoverStroke,
  weight: 2,
  opacity: 1,
};

const TOWNSHIP_SELECTED_STYLE: L.PathOptions = {
  fillColor: GREENTWIN_MAP_COLORS.admin.selectedFill,
  fillOpacity: 0.22,
  color: GREENTWIN_MAP_COLORS.admin.selectedStroke,
  weight: 2.6,
  opacity: 1,
};

const TOWNSHIP_DIMMED_STYLE: L.PathOptions = {
  fillColor: "#041b18",
  fillOpacity: 0.24,
  color: "#758e80",
  weight: 1,
  opacity: 0.35,
};

export function resolveTownshipVisualState(
  name: string,
  selectedTownship: string | null,
  hoveredTownship: string | null,
): TownshipVisualState {
  if (selectedTownship)
    return selectedTownship === name ? "selected" : "dimmed";
  return hoveredTownship === name ? "hover" : "normal";
}

export function getTownshipPathStyle(
  state: TownshipVisualState,
  baseStyle: L.PathOptions = TOWNSHIP_NORMAL_STYLE,
): L.PathOptions {
  if (state === "normal") return { ...baseStyle };
  if (state === "hover") return { ...baseStyle, ...TOWNSHIP_HOVER_STYLE };
  if (state === "dimmed") return { ...baseStyle, ...TOWNSHIP_DIMMED_STYLE };

  return {
    ...baseStyle,
    ...TOWNSHIP_SELECTED_STYLE,
    fillColor: TOWNSHIP_SELECTED_STYLE.fillColor,
  };
}

export function getTownshipLabelOpacity(state: TownshipVisualState) {
  return state === "dimmed" ? 0.42 : 1;
}
