export interface SimulationPlot {
  key: string
  label: string
  description: string
  center: { longitude: number; latitude: number }
  ring: Array<[longitude: number, latitude: number]>
}

export function createPlotRectangle(
  longitude: number,
  latitude: number,
  widthMeters: number,
  heightMeters: number,
  headingDegrees: number,
): Array<[longitude: number, latitude: number]> {
  const latitudeScale = 111_320
  const longitudeScale = latitudeScale * Math.cos((latitude * Math.PI) / 180)
  const halfWidth = widthMeters / 2
  const halfHeight = heightMeters / 2
  const angle = (headingDegrees * Math.PI) / 180
  const cosine = Math.cos(angle)
  const sine = Math.sin(angle)
  const offsets: Array<[number, number]> = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ]
  const corners = offsets.map(([x, y]) => {
    const east = x * cosine - y * sine
    const north = x * sine + y * cosine
    return [
      longitude + east / longitudeScale,
      latitude + north / latitudeScale,
    ] as [number, number]
  })
  return [...corners, corners[0]!]
}

export const SIMULATION_PLOTS: readonly SimulationPlot[] = [
  {
    key: 'xuchang-renewal',
    label: '徐场村更新地块',
    description: '村庄公共空间与生活服务设施更新',
    center: { longitude: 114.965, latitude: 34.95 },
    ring: createPlotRectangle(114.965, 34.95, 118, 76, 8),
  },
  {
    key: 'guyang-industry',
    label: '堌阳东侧产业地块',
    description: '生产空间整理与乡村产业设施提升',
    center: { longitude: 114.96625, latitude: 34.95058 },
    ring: createPlotRectangle(114.96625, 34.95058, 142, 88, -14),
  },
  {
    key: 'canal-ecology',
    label: '北部河渠生态地块',
    description: '滨水缓冲带与生态修复示范空间',
    center: { longitude: 114.96392, latitude: 34.95105 },
    ring: createPlotRectangle(114.96392, 34.95105, 156, 68, 24),
  },
]
