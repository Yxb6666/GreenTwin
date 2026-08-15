import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PlotApplicationDialog from '@/features/twin/PlotApplicationDialog.vue'
import { SIMULATION_PLOTS } from '@/features/twin/plotParcels'

describe('地块应用场景弹窗', () => {
  it('展示当前地块的推荐方向、应用场景和标签', () => {
    const plot = SIMULATION_PLOTS[0]!
    const wrapper = mount(PlotApplicationDialog, {
      props: { open: true, plot, position: { x: 420, y: 360 } },
    })

    expect(wrapper.get('[role="dialog"]').attributes('aria-modal')).toBe('false')
    expect(wrapper.get('[role="dialog"]').attributes('style')).toContain(
      'left: 420px',
    )
    expect(wrapper.text()).toContain(plot.label)
    expect(wrapper.text()).toContain(plot.applicationLabel)
    plot.applicationScenarios.forEach((scenario) => {
      expect(wrapper.text()).toContain(scenario.label)
    })
    plot.applicationTags.forEach((tag) => {
      expect(wrapper.text()).toContain(tag)
    })
  })

  it('支持关闭按钮', async () => {
    const wrapper = mount(PlotApplicationDialog, {
      props: {
        open: true,
        plot: SIMULATION_PLOTS[1]!,
        position: { x: 320, y: 300 },
      },
    })

    await wrapper.get('header button').trigger('click')

    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('关闭状态不渲染弹窗', () => {
    const wrapper = mount(PlotApplicationDialog, {
      props: {
        open: false,
        plot: SIMULATION_PLOTS[0]!,
        position: { x: 0, y: 0 },
      },
    })

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })
})
