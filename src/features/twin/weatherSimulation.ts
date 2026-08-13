export type WeatherKind = 'clear' | 'storm' | 'snow' | 'fog'

export interface WeatherState {
  kind: WeatherKind
  intensity: number
  windSpeed: number
  windDirection: number
}

export interface WeatherMetrics {
  label: string
  icon: string
  temperature: number
  precipitation: number
  visibility: number
  cloudCover: number
}

export const weatherPresets: Array<{
  kind: WeatherKind
  label: string
  icon: string
  intensity: number
  windSpeed: number
}> = [
  { kind: 'clear', label: '晴', icon: '晴', intensity: 0, windSpeed: 2 },
  { kind: 'storm', label: '暴雨', icon: '暴', intensity: 82, windSpeed: 8 },
  { kind: 'snow', label: '雪', icon: '雪', intensity: 52, windSpeed: 3 },
  { kind: 'fog', label: '雾', icon: '雾', intensity: 62, windSpeed: 1 },
]

const weatherBase: Record<
  WeatherKind,
  Omit<WeatherMetrics, 'label' | 'icon'> & { label: string; icon: string }
> = {
  clear: {
    label: '晴朗',
    icon: '晴',
    temperature: 27,
    precipitation: 0,
    visibility: 20000,
    cloudCover: 12,
  },
  storm: {
    label: '短时暴雨',
    icon: '暴',
    temperature: 18,
    precipitation: 72,
    visibility: 3800,
    cloudCover: 96,
  },
  snow: {
    label: '降雪',
    icon: '雪',
    temperature: -2,
    precipitation: 8,
    visibility: 6500,
    cloudCover: 88,
  },
  fog: {
    label: '大雾',
    icon: '雾',
    temperature: 11,
    precipitation: 0,
    visibility: 1200,
    cloudCover: 72,
  },
}

export function clampWeatherValue(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min))
}

export function createWeatherState(kind: WeatherKind = 'clear'): WeatherState {
  const preset =
    weatherPresets.find((item) => item.kind === kind) ?? weatherPresets[0]!
  return {
    kind: preset.kind,
    intensity: preset.intensity,
    windSpeed: preset.windSpeed,
    windDirection: 105,
  }
}

export function resolveWeatherMetrics(state: WeatherState): WeatherMetrics {
  const base = weatherBase[state.kind]
  const factor = clampWeatherValue(state.intensity) / 100

  if (state.kind === 'clear') return { ...base }

  const visibilityFloor = state.kind === 'fog' ? 180 : 900
  return {
    ...base,
    precipitation:
      Math.round(base.precipitation * (0.35 + factor * 0.95) * 10) / 10,
    visibility: Math.round(
      Math.max(visibilityFloor, base.visibility * (1.35 - factor * 0.9)),
    ),
    cloudCover: Math.round(
      Math.min(100, base.cloudCover * (0.65 + factor * 0.5)),
    ),
  }
}

export function describeWeatherRisk(state: WeatherState) {
  const metrics = resolveWeatherMetrics(state)
  if (metrics.precipitation >= 50)
    return '积水风险高，建议重点核验排水口和低洼路段'
  if (metrics.precipitation >= 15)
    return '存在积水风险，建议联动排水方案开展推演'
  if (metrics.visibility <= 1500) return '能见度较低，需关注施工与交通安全'
  if (state.kind === 'snow') return '需关注道路结冰和设施承载风险'
  return '天气条件稳定，可作为方案基准场景'
}
