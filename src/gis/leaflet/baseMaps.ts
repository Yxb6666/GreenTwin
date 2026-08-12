export type BaseMapMode =
  | 'natural'
  | 'ecology'
  | 'planning'
  | 'night'
  | 'light-gray'
  | 'dark-gray'
  | 'outdoor'
  | 'standard'

export interface BaseMapOption {
  key: BaseMapMode
  name: string
  meta: string
  source: 'supermap' | 'arcgis'
  arcgisStyle?: string
  tileUrl?: string
  previewUrl?: string
}

export const BASE_MAP_OPTIONS: readonly BaseMapOption[] = [
  {
    key: 'light-gray',
    name: 'ArcGIS 浅灰',
    meta: '突出业务专题',
    source: 'arcgis',
    arcgisStyle: 'arcgis/light-gray',
    previewUrl:
      'https://www.arcgis.com/sharing/rest/content/items/0f74af7609054be8a29e0ba5f154f0a8/info/thumbnail/thumbnail1659480444177.png',
  },
  {
    key: 'dark-gray',
    name: 'ArcGIS 深灰',
    meta: '暗色专题分析',
    source: 'arcgis',
    arcgisStyle: 'arcgis/dark-gray',
    previewUrl:
      'https://www.arcgis.com/sharing/rest/content/items/7742cd5abef8497288dc81426266df9b/info/thumbnail/thumbnail1659479985387.png',
  },
  {
    key: 'outdoor',
    name: 'ArcGIS 户外',
    meta: '地形水系道路',
    source: 'arcgis',
    arcgisStyle: 'arcgis/outdoor',
    previewUrl:
      'https://www.arcgis.com/sharing/rest/content/items/659e7c1b1e374f6c8a89eefe17b23380/info/thumbnail/thumbnail1658946460034.png',
  },
  {
    key: 'standard',
    name: 'ArcGIS 标准影像',
    meta: '无注记纯影像',
    source: 'arcgis',
    tileUrl: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    previewUrl:
      'https://www.arcgis.com/sharing/rest/content/items/c7d2b5c334364e8fb5b73b0f4d6a779b/info/thumbnail/thumbnail1659480145425.png',
  },
]

export function getBaseMapOption(mode: BaseMapMode) {
  return BASE_MAP_OPTIONS.find((option) => option.key === mode)
}

export function requiresArcGisAccessToken(option: BaseMapOption) {
  return option.source === 'arcgis' && !option.tileUrl
}

export function buildArcGisTileUrl(style: string, accessToken: string) {
  const encodedStyle = style
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/')
  return `https://static-map-tiles-api.arcgis.com/arcgis/rest/services/static-basemap-tiles-service/v1/${encodedStyle}/static/tile/{z}/{y}/{x}?token=${encodeURIComponent(accessToken)}`
}
