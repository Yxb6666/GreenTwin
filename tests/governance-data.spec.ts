import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  distanceInMeters,
  parseGovernanceIssues,
  queryIssuesByBounds,
  queryIssuesByRadius,
} from '@/features/governance/data'

const dataPath = resolve(
  process.cwd(),
  'public/data/governance/governance-issues.geojson',
)

describe('乡村治理问题要素数据', () => {
  const collection: unknown = JSON.parse(readFileSync(dataPath, 'utf8'))
  const issues = parseGovernanceIssues(collection)

  it('解析覆盖全部乡镇街道的有效点要素', () => {
    expect(issues).toHaveLength(116)
    expect(new Set(issues.map((issue) => issue.townCode))).toHaveLength(16)
    expect(
      issues.every((issue) => issue.longitude > 114 && issue.latitude > 34),
    ).toBe(true)
    expect(issues.every((issue) => issue.villageCode && issue.address)).toBe(
      true,
    )
    expect(
      issues.every((issue) => issue.channel && issue.dataClass === '场景模拟'),
    ).toBe(true)
  })

  it('采用有差异的乡镇配额并形成局部热点，而不是均匀铺点', () => {
    const townCounts = [
      ...issues
        .reduce((counts, issue) => {
          counts.set(issue.town, (counts.get(issue.town) ?? 0) + 1)
          return counts
        }, new Map<string, number>())
        .values(),
    ]
    expect(Math.max(...townCounts)).toBe(16)
    expect(Math.min(...townCounts)).toBe(4)
    expect(new Set(townCounts).size).toBeGreaterThan(5)

    const nearAnotherIssue = issues.filter((issue) =>
      issues.some(
        (candidate) =>
          candidate.id !== issue.id &&
          candidate.town === issue.town &&
          Math.hypot(
            candidate.longitude - issue.longitude,
            candidate.latitude - issue.latitude,
          ) < 0.01,
      ),
    )
    expect(nearAnotherIssue.length).toBeGreaterThan(75)
  })

  it('忽略几何或业务枚举不合法的要素', () => {
    expect(
      parseGovernanceIssues({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: { type: 'Polygon', coordinates: [] },
            properties: {},
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [114.8, 34.8] },
            properties: {
              id: 'BAD-1',
              type: '测试',
              town: '测试乡',
              urgency: '特急',
              status: '待审核',
            },
          },
        ],
      }),
    ).toEqual([])
  })

  it('按矩形范围查询并保留边界上的点', () => {
    const target = issues[0]!
    expect(
      queryIssuesByBounds(issues, {
        south: target.latitude,
        west: target.longitude,
        north: target.latitude,
        east: target.longitude,
      }).map((issue) => issue.id),
    ).toEqual([target.id])
  })

  it('按地表距离执行圆形查询', () => {
    expect(distanceInMeters([34.8, 114.8], [34.8, 114.81])).toBeGreaterThan(900)
    expect(distanceInMeters([34.8, 114.8], [34.8, 114.81])).toBeLessThan(920)

    const target = issues[0]!
    expect(
      queryIssuesByRadius(issues, [target.latitude, target.longitude], 10).map(
        (issue) => issue.id,
      ),
    ).toEqual([target.id])
  })
})
