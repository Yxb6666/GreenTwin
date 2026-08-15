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
    description: '村庄公共空间与生活服务设施更新',
    applicationLabel: '生活服务与公共空间更新',
    applicationSummary:
      '适合验证村庄公共服务补短板、闲置空间再利用和居民日常活动场景。',
    applicationScenarios: [
      {
        icon: '服',
        label: '便民服务设施',
        description: '配置综合服务站、养老助餐与便民零售等生活服务。',
      },
      {
        icon: '邻',
        label: '邻里共享空间',
        description: '模拟口袋公园、儿童活动与村民议事空间的组合布局。',
      },
      {
        icon: '新',
        label: '闲置地块更新',
        description: '比选低效用地盘活、建筑植入与慢行环境改善方案。',
      },
    ],
    applicationTags: ['生活空间', '公共服务', '存量更新'],
    center: { longitude: 114.96765, latitude: 34.94985 },
    ring: createPlotRectangle(114.96765, 34.94985, 118, 76, 0),
  },
  {
    key: 'guyang-industry',
    label: '堌阳东侧规划地块',
    description: '生产空间整理与乡村产业设施提升',
    applicationLabel: '乡村产业与生产设施提升',
    applicationSummary:
      '适合推演农产品加工、仓储物流和产业配套设施的空间组织与建设影响。',
    applicationScenarios: [
      {
        icon: '产',
        label: '农产品加工',
        description: '模拟加工车间、分拣包装与生产辅助空间布局。',
      },
      {
        icon: '储',
        label: '仓储物流组织',
        description: '验证仓储容量、车辆流线与装卸节点的配置关系。',
      },
      {
        icon: '配',
        label: '产业配套完善',
        description: '比选管理、展示、电商与就业服务等复合功能。',
      },
    ],
    applicationTags: ['生产空间', '产业振兴', '设施提升'],
    center: { longitude: 114.97813, latitude: 34.9571 },
    ring: createPlotRectangle(114.97813, 34.9571, 142, 88, -12),
  },
]
