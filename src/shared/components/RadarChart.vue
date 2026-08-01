<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    labels: string[]
    values: number[]
    color?: string
  }>(),
  { color: '#3dd6c4' },
)

const points = computed(() => {
  const center = 100
  const radius = 72
  return props.values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / props.values.length
      const ratio = Math.max(0, Math.min(100, value)) / 100
      return `${center + Math.cos(angle) * radius * ratio},${center + Math.sin(angle) * radius * ratio}`
    })
    .join(' ')
})

const axes = computed(() =>
  props.labels.map((label, index) => {
    const angle = -Math.PI / 2 + (Math.PI * 2 * index) / props.labels.length
    return {
      label,
      x: 100 + Math.cos(angle) * 92,
      y: 100 + Math.sin(angle) * 92,
      ax: 100 + Math.cos(angle) * 72,
      ay: 100 + Math.sin(angle) * 72,
    }
  }),
)

function gridPoints(level: number) {
  return props.labels
    .map((_, index) => {
      const angle = -Math.PI / 2 + (Math.PI * 2 * index) / props.labels.length
      return `${100 + Math.cos(angle) * 72 * level},${100 + Math.sin(angle) * 72 * level}`
    })
    .join(' ')
}
</script>

<template>
  <svg class="radar-chart" viewBox="0 0 200 200" role="img" aria-label="指标雷达图">
    <polygon v-for="level in [0.25, 0.5, 0.75, 1]" :key="level" :points="gridPoints(level)" class="radar-grid" />
    <g v-for="axis in axes" :key="axis.label">
      <line x1="100" y1="100" :x2="axis.ax" :y2="axis.ay" class="radar-axis" />
      <text :x="axis.x" :y="axis.y" text-anchor="middle" dominant-baseline="middle">{{ axis.label }}</text>
    </g>
    <polygon :points="points" :style="{ '--radar-color': color }" class="radar-value" />
  </svg>
</template>
