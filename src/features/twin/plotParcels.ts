export interface SimulationPlot {
  key: string
  label: string
  description: string
  applicationLabel: string
  applicationSummary: string
  applicationScenarios: Array<{
    icon: string
    label: string
    description: string
  }>
  applicationTags: string[]
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
    label: '徐场村规划地块',
    description: '新建口袋公园，补充村庄公共活动空间',
    applicationLabel: '口袋公园',
    applicationSummary:
      '建设服务村民日常休憩、儿童活动和邻里交流的小型公共绿地。',
    applicationScenarios: [
      {
        icon: '憩',
        label: '休憩座椅',
        description: '设置日常停留、休息与邻里交流空间。',
      },
      {
        icon: '童',
        label: '儿童活动区',
        description: '配置安全、开放的儿童活动场地。',
      },
      {
        icon: '绿',
        label: '绿化景观',
        description: '通过绿化种植改善地块环境与步行体验。',
      },
    ],
    applicationTags: ['休闲游憩', '儿童活动', '生态绿化'],
    center: { longitude: 114.96765, latitude: 34.94985 },
    ring: createPlotRectangle(114.96765, 34.94985, 118, 76, 0),
  },
  {
    key: 'guyang-industry',
    label: '堌阳东侧规划地块',
    description: '新建工厂，完善生产与仓储配套',
    applicationLabel: '工厂',
    applicationSummary:
      '建设包含生产加工、仓储装卸和管理配套功能的乡村工厂。',
    applicationScenarios: [
      {
        icon: '产',
        label: '生产车间',
        description: '布置生产加工与辅助作业空间。',
      },
      {
        icon: '储',
        label: '仓储装卸区',
        description: '组织仓储、车辆流线与装卸场地。',
      },
      {
        icon: '配',
        label: '管理配套用房',
        description: '配置办公、管理与必要的服务空间。',
      },
    ],
    applicationTags: ['生产加工', '仓储物流', '配套服务'],
    center: { longitude: 114.97764, latitude: 34.9572 },
    ring: createPlotRectangle(114.97764, 34.9572, 142, 88, -12),
  },
]
