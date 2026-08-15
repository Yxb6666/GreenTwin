import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import SceneToolbox from '@/features/twin/SceneToolbox.vue'

const layers = [
  { key: 'buildingLayer', label: '建筑', visible: true },
  { key: 'roadLayer', label: '道路', visible: true },
  { key: 'waterLayer', label: '水系', visible: false },
  { key: 'issueLayer', label: '问题点', visible: true },
]

describe('三维场景工具条', () => {
  it('清除、缩放、定位按钮发出对应事件', async () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: null, layers, feedback: '' },
    })
    await wrapper
      .get('button[aria-label="清除标绘与测量结果"]')
      .trigger('click')
    await wrapper.get('button[aria-label="放大场景"]').trigger('click')
    await wrapper.get('button[aria-label="缩小场景"]').trigger('click')
    await wrapper.get('button[aria-label="定位到当前落点"]').trigger('click')

    expect(wrapper.emitted('clear')).toHaveLength(1)
    expect(wrapper.emitted('zoom-in')).toHaveLength(1)
    expect(wrapper.emitted('zoom-out')).toHaveLength(1)
    expect(wrapper.emitted('locate')).toHaveLength(1)
  })

  it('测量菜单可选择距离或面积', async () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: null, layers, feedback: '' },
    })
    await wrapper.get('button[aria-label="测量工具"]').trigger('click')
    const options = wrapper.findAll('.measure-panel button')

    expect(options).toHaveLength(2)
    await options[0]!.trigger('click')
    expect(wrapper.emitted('measure')?.[0]).toEqual(['distance'])
  })

  it('测量中点击工具条发出结束测量事件', async () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: 'area', layers, feedback: '' },
    })
    await wrapper.get('button[aria-label="测量工具"]').trigger('click')

    expect(wrapper.emitted('end-measure')).toHaveLength(1)
  })

  it('图层开关发出更新事件', async () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: null, layers, feedback: '' },
    })
    await wrapper.get('button[aria-label="场景图层"]').trigger('click')
    const input = wrapper.get('.layer-panel input[type="checkbox"]')

    await input.setValue(false)
    expect(wrapper.emitted('update-layer')?.[0]).toEqual([
      'buildingLayer',
      false,
    ])
  })

  it('天气按钮以小插件方式控制天气面板展开与收起', async () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: null, layers, feedback: '', weatherActive: false },
    })

    const button = wrapper.get('button[aria-label="天气模拟"]')
    expect(button.attributes('aria-expanded')).toBe('false')
    await button.trigger('click')

    expect(wrapper.emitted('toggle-weather')).toHaveLength(1)
  })

  it('空间分析面板提供日照阴影开关、时间和快捷时段', async () => {
    const wrapper = mount(SceneToolbox, {
      props: {
        measuring: null,
        layers,
        feedback: '',
        shadowActive: false,
        shadowTime: '2026-06-21T15:00',
      },
    })

    await wrapper.get('button[aria-label="空间分析"]').trigger('click')
    expect(wrapper.find('.analysis-panel').text()).toContain('日照阴影分析')
    expect(wrapper.find('.analysis-panel').text()).not.toContain('通视分析')
    expect(wrapper.find('.shadow-analysis-card__status svg').exists()).toBe(
      true,
    )
    expect(wrapper.find('.shadow-analysis-card__tip svg').exists()).toBe(true)
    expect(
      (wrapper.get('input[type="datetime-local"]').element as HTMLInputElement)
        .value,
    ).toBe('2026-06-21T15:00')

    await wrapper.get('.shadow-toggle').trigger('click')
    await wrapper.findAll('.shadow-presets button')[1]!.trigger('click')

    expect(wrapper.emitted('toggle-shadow')).toHaveLength(1)
    expect(wrapper.emitted('update-shadow-time')?.[0]).toEqual([
      '2026-06-21T12:00',
    ])
  })

  it('日照分析按钮使用太阳与建筑组合图标', () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: null, layers, feedback: '' },
    })
    const icon = wrapper.get('.scene-toolbox__sunlight-icon')

    expect(icon.find('circle').attributes()).toMatchObject({
      cx: '7',
      cy: '7',
      r: '2.5',
    })
    expect(icon.findAll('path')).toHaveLength(2)
  })

  it('日照分析与天气按钮位于场景右侧工具组', () => {
    const wrapper = mount(SceneToolbox, {
      props: { measuring: null, layers, feedback: '' },
    })
    const rightRail = wrapper.get('.scene-toolbox__rail--right')
    const labels = rightRail
      .findAll('button')
      .map((button) => button.attributes('aria-label'))

    expect(labels).toEqual(['空间分析', '天气模拟'])
    expect(
      wrapper
        .get('.scene-toolbox__rail:not(.scene-toolbox__rail--right)')
        .findAll('button'),
    ).toHaveLength(5)
  })
})
