import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import WeatherSimulation from '@/features/twin/WeatherSimulation.vue'
import {
  createWeatherState,
  describeWeatherRisk,
  resolveWeatherMetrics,
} from '@/features/twin/weatherSimulation'

describe('三生模拟天气功能', () => {
  it('按天气类型和强度计算降水、能见度与风险', () => {
    const rain = createWeatherState('storm')
    const metrics = resolveWeatherMetrics(rain)

    expect(metrics.label).toBe('短时暴雨')
    expect(metrics.precipitation).toBeGreaterThanOrEqual(50)
    expect(metrics.visibility).toBeLessThan(3800)
    expect(describeWeatherRisk(rain)).toContain('积水风险高')
  })

  it('提供五种天气预设并可调节天气强度', async () => {
    const wrapper = mount(WeatherSimulation, {
      props: {
        modelValue: createWeatherState('clear'),
        nativeEffects: false,
        open: true,
      },
    })

    const presets = wrapper.findAll('.weather-presets button')
    expect(presets).toHaveLength(4)
    expect(wrapper.text()).not.toContain('雨雨')
    await presets[1]!.trigger('click')

    const update = wrapper.emitted('update:modelValue')?.at(-1)?.[0]
    expect(update).toMatchObject({ kind: 'storm', intensity: 82 })
  })

  it('原生特效不可用时保留降水可视化回退', () => {
    const wrapper = mount(WeatherSimulation, {
      props: {
        modelValue: createWeatherState('storm'),
        nativeEffects: false,
        open: false,
      },
    })

    expect(wrapper.find('.weather-particles').exists()).toBe(true)
    expect(wrapper.find('.weather-panel').exists()).toBe(false)
  })
})
