import { describe, expect, it } from 'vitest'
import {
  COUNTY_SANSHENG_SCORES,
  resolveMasterSanshengEvaluation,
} from '@/features/master/sanshengSelection'
import {
  DEFAULT_DIMENSION_WEIGHTS,
  scoreTown,
  towns,
} from '@/features/sansheng/model'

describe('主控页面行政区三生评价联动', () => {
  it('未选择行政区或复位后展示原县域评价', () => {
    expect(resolveMasterSanshengEvaluation(null)).toEqual({
      areaName: '兰考县',
      meta: '县域协同指数',
      scope: 'county',
      scores: COUNTY_SANSHENG_SCORES,
    })
  })

  it.each(['仪封镇', '堌阳镇', '兰阳街道', '许河镇'])(
    '精确匹配 %s 并复用三生模型评分',
    (name) => {
      const town = towns.find((item) => item.name === name)!
      const expected = scoreTown(town, DEFAULT_DIMENSION_WEIGHTS)

      expect(resolveMasterSanshengEvaluation(` ${name} `)).toEqual({
        areaName: name,
        meta: `${name} / 行政区评价`,
        scope: 'township',
        scores: expected,
      })
    },
  )

  it('不猜测映射，数据中不存在的名称返回空状态', () => {
    const name = '不存在乡镇'
    expect(resolveMasterSanshengEvaluation(name)).toEqual({
      areaName: name,
      meta: `${name} / 行政区评价`,
      scope: 'unavailable',
      scores: null,
    })
  })
})
