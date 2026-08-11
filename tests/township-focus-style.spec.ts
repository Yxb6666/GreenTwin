import { describe, expect, it } from 'vitest'
import {
  getTownshipLabelOpacity,
  getTownshipPathStyle,
  resolveTownshipVisualState,
  TOWNSHIP_NORMAL_STYLE,
} from '@/gis/leaflet/townshipFocusStyle'

describe('行政区聚光灯视觉状态', () => {
  it('无选中时在 normal 与 hover 之间切换', () => {
    expect(resolveTownshipVisualState('惠安街道', null, null)).toBe('normal')
    expect(resolveTownshipVisualState('惠安街道', null, '惠安街道')).toBe('hover')
  })

  it('存在选中时仅选中区高亮，其他行政区暗化', () => {
    expect(resolveTownshipVisualState('考城镇', '考城镇', '考城镇')).toBe('selected')
    expect(resolveTownshipVisualState('谷营镇', '考城镇', '谷营镇')).toBe('dimmed')
  })

  it('selected 保留当前专题填充色并强化边界', () => {
    const style = getTownshipPathStyle('selected', { ...TOWNSHIP_NORMAL_STYLE, fillColor: '#987654' })

    expect(style).toMatchObject({
      fillColor: '#987654',
      fillOpacity: 0.08,
      color: '#edf6cb',
      weight: 3.2,
      opacity: 1,
    })
  })

  it('dimmed 使用深绿蒙版且标签保留四成可见度', () => {
    expect(getTownshipPathStyle('dimmed')).toMatchObject({
      fillColor: '#041b18',
      fillOpacity: 0.24,
      color: '#758e80',
      weight: 1,
      opacity: 0.35,
    })
    expect(getTownshipLabelOpacity('dimmed')).toBe(0.42)
    expect(getTownshipLabelOpacity('selected')).toBe(1)
  })
})
