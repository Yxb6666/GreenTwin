import type { InjectionKey } from 'vue'

export interface RuntimeConfig {
  appTitle: string
  apiBaseUrl: string
  requestTimeoutMs: number
  reportTimeoutMs: number
  map: {
    center: [number, number]
    zoom: number
    crs: 'EPSG4326' | 'EPSG3857'
  }
  supermap: {
    leafletSdkUrl: string
    mapServices: Record<'base' | 'population' | 'gdp' | 'landuse', string>
    webglSdkUrl: string
    webglWidgetsCssUrl: string
    realspace: Record<'whiteModel' | 'oblique' | 'lidar', string>
  }
}

export const runtimeConfigKey = Symbol('runtimeConfig') as InjectionKey<Readonly<RuntimeConfig>>

function validateConfig(value: unknown): asserts value is RuntimeConfig {
  if (!value || typeof value !== 'object') throw new Error('runtime-config.json 内容为空')
  const config = value as Partial<RuntimeConfig>
  if (!config.appTitle || !config.apiBaseUrl) throw new Error('缺少 appTitle 或 apiBaseUrl')
  if (!config.reportTimeoutMs || config.reportTimeoutMs < 10000) throw new Error('reportTimeoutMs 必须不少于 10000')
  if (!config.map || !Array.isArray(config.map.center) || config.map.center.length !== 2) {
    throw new Error('map.center 必须是 [纬度, 经度]')
  }
  if (config.map.crs !== 'EPSG4326' && config.map.crs !== 'EPSG3857') {
    throw new Error('map.crs 必须是 EPSG4326 或 EPSG3857')
  }
  if (!config.supermap?.leafletSdkUrl || !config.supermap.mapServices?.base) {
    throw new Error('缺少 supermap.leafletSdkUrl 或 supermap.mapServices.base')
  }
}

export async function loadRuntimeConfig(): Promise<Readonly<RuntimeConfig>> {
  const response = await fetch(`${import.meta.env.BASE_URL}config/runtime-config.json`, {
    cache: 'no-store',
  })
  if (!response.ok) throw new Error(`运行配置请求失败（HTTP ${response.status}）`)
  const config: unknown = await response.json()
  validateConfig(config)
  return Object.freeze(config)
}
