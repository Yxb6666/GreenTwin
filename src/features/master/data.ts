export interface PopulationRecord {
  year: number
  populationWan: number
  areaKm2: number | null
}

export interface GdpRecord {
  year: number
  gdpTenThousandYuan: number
}

// 数据源：Lankao_2000_2025_GDP_Population.xlsx / Sheet1。
// 对应字段：年份、行政区域土地面积、年末总人口、地区生产总值。
export const populationRecords: PopulationRecord[] = [
  { year: 2020, populationWan: 78, areaKm2: 1116 },
  { year: 2021, populationWan: 76, areaKm2: 1116 },
  { year: 2022, populationWan: 76, areaKm2: 1103 },
  { year: 2023, populationWan: 76, areaKm2: 1103 },
  { year: 2024, populationWan: 76, areaKm2: 1103 },
  { year: 2025, populationWan: 76, areaKm2: null },
]

export const gdpRecords: GdpRecord[] = [
  { year: 2020, gdpTenThousandYuan: 3832374 },
  { year: 2021, gdpTenThousandYuan: 4067643 },
  { year: 2022, gdpTenThousandYuan: 4260958 },
  { year: 2023, gdpTenThousandYuan: 4071800 },
  { year: 2024, gdpTenThousandYuan: 4620933 },
  { year: 2025, gdpTenThousandYuan: 4752800 },
]

function toBarPercent(value: number, maximum: number) {
  return Number(((value / maximum) * 100).toFixed(1))
}

export const latestPopulation = populationRecords.at(-1)!
export const previousPopulation = populationRecords.at(-2)!
export const latestDensityRecord = populationRecords
  .filter((record) => record.areaKm2 !== null)
  .at(-1)!
export const latestPopulationGrowth = Number(
  (
    ((latestPopulation.populationWan - previousPopulation.populationWan) /
      previousPopulation.populationWan) *
    100
  ).toFixed(1),
)
export const latestPopulationDensity = Math.round(
  (latestDensityRecord.populationWan * 10000) / latestDensityRecord.areaKm2!,
)

export function calculatePopulationChangeRate(records: readonly PopulationRecord[]) {
  const first = records.at(0)?.populationWan
  const last = records.at(-1)?.populationWan
  if (first === undefined || last === undefined || first === 0) return 0
  return Number((((last - first) / first) * 100).toFixed(1))
}

export function getPopulationTrendLabel(changeRate: number) {
  if (Math.abs(changeRate) < 3) return '总体稳定'
  if (changeRate > 0) return changeRate < 10 ? '小幅增长' : '整体增长'
  return changeRate > -10 ? '小幅下降' : '整体下降'
}

const maximumPopulation = Math.max(
  ...populationRecords.map((record) => record.populationWan),
)
const maximumGdp = Math.max(
  ...gdpRecords.map((record) => record.gdpTenThousandYuan),
)

export const populationTrend = populationRecords.map((record) => ({
  ...record,
  barPercent: toBarPercent(record.populationWan, maximumPopulation),
}))

export const gdpTrend = gdpRecords.map((record) => ({
  ...record,
  gdpYiYuan: record.gdpTenThousandYuan / 10000,
  barPercent: toBarPercent(record.gdpTenThousandYuan, maximumGdp),
}))
