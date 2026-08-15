<script setup lang="ts">
import type { SimulationPlot } from './plotParcels'

defineProps<{
  open: boolean
  plot: SimulationPlot
  position: { x: number; y: number }
}>()

defineEmits<{
  close: []
}>()
</script>

<template>
  <Transition name="plot-dialog">
    <section
      v-if="open"
      class="plot-map-popup"
      :style="{ left: `${position.x}px`, top: `${position.y}px` }"
      role="dialog"
      aria-modal="false"
      aria-labelledby="plot-application-title"
    >
      <header>
        <div>
          <h2 id="plot-application-title">{{ plot.label }}应用场景</h2>
          <small>规划地块信息</small>
        </div>
        <button type="button" aria-label="关闭应用场景弹窗" @click="$emit('close')">
          ×
        </button>
      </header>

      <div class="plot-popup-toolbar" aria-hidden="true">
        <span>⌖</span><small>点击地块查看规划建议</small>
      </div>

      <dl class="plot-popup-table">
        <div>
          <dt>推荐场景</dt>
          <dd><strong>{{ plot.applicationLabel }}</strong></dd>
        </div>
        <div>
          <dt>应用方向</dt>
          <dd>{{ plot.applicationTags.join(' · ') }}</dd>
        </div>
        <div
          v-for="scenario in plot.applicationScenarios"
          :key="scenario.label"
        >
          <dt>{{ scenario.label }}</dt>
          <dd>{{ scenario.description }}</dd>
        </div>
      </dl>

      <p class="plot-popup-note">{{ plot.applicationSummary }}</p>
    </section>
  </Transition>
</template>

<style scoped>
.plot-map-popup {
  position: absolute;
  z-index: 320;
  width: 350px;
  color: var(--text);
  border: 1px solid rgba(122, 203, 190, 0.54);
  border-radius: 4px;
  background:
    linear-gradient(135deg, rgba(61, 214, 196, 0.055), transparent 48%),
    rgba(8, 25, 25, 0.97);
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.42);
  transform: translate(-50%, calc(-100% - 14px));
}

.plot-map-popup::before,
.plot-map-popup::after {
  position: absolute;
  top: 100%;
  left: 50%;
  width: 0;
  height: 0;
  content: '';
  transform: translateX(-50%);
}

.plot-map-popup::before {
  border: 14px solid transparent;
  border-top-color: rgba(122, 203, 190, 0.54);
}

.plot-map-popup::after {
  margin-top: -1px;
  border: 12px solid transparent;
  border-top-color: rgba(8, 25, 25, 0.98);
}

.plot-map-popup > header {
  display: grid;
  align-items: center;
  min-height: 48px;
  padding: 8px 10px 8px 12px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.14);
  background: rgba(61, 214, 196, 0.04);
  grid-template-columns: 1fr 26px;
}

.plot-map-popup > header > div {
  display: grid;
  gap: 2px;
}

.plot-map-popup h2 {
  margin: 0;
  font-size: 11px;
}

.plot-map-popup header small {
  color: var(--text-soft);
  font-size: 7px;
}

.plot-map-popup > header button {
  display: grid;
  width: 24px;
  height: 24px;
  padding: 0 0 2px;
  place-content: center;
  color: var(--text-soft);
  border: 0;
  background: transparent;
  font: 16px/1 var(--font-body);
  cursor: pointer;
}

.plot-popup-toolbar {
  display: flex;
  align-items: center;
  min-height: 30px;
  padding: 5px 10px;
  gap: 6px;
  color: var(--text-soft);
  border-bottom: 1px solid rgba(122, 203, 190, 0.11);
  font-size: 8px;
}

.plot-popup-toolbar span {
  color: var(--cyan);
  font: 12px var(--font-data);
}

.plot-popup-table {
  margin: 0;
  padding: 10px;
}

.plot-popup-table > div {
  display: grid;
  min-height: 36px;
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-bottom: 0;
  grid-template-columns: 94px 1fr;
}

.plot-popup-table > div:last-child {
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
}

.plot-popup-table dt,
.plot-popup-table dd {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 6px 8px;
  font-size: 8px;
  line-height: 1.45;
}

.plot-popup-table dt {
  color: var(--text-soft);
  background: rgba(255, 255, 255, 0.035);
}

.plot-popup-table dd {
  color: var(--text);
  border-left: 1px solid rgba(122, 203, 190, 0.1);
}

.plot-popup-table dd strong {
  color: #ffd28a;
  font-size: 8px;
}

.plot-popup-note {
  margin: -2px 10px 10px;
  padding: 7px 8px;
  color: var(--text-soft);
  border-left: 2px solid var(--cyan);
  background: rgba(61, 214, 196, 0.055);
  font-size: 7px;
  line-height: 1.55;
}

.plot-dialog-enter-active,
.plot-dialog-leave-active {
  transition: opacity 150ms ease;
}

.plot-dialog-enter-active.plot-map-popup,
.plot-dialog-leave-active.plot-map-popup {
  transition: transform 150ms ease;
}

.plot-dialog-enter-from,
.plot-dialog-leave-to {
  opacity: 0;
}

.plot-dialog-enter-from.plot-map-popup,
.plot-dialog-leave-to.plot-map-popup {
  transform: translate(-50%, calc(-100% - 8px)) scale(0.98);
}

@media (max-height: 760px) {
  .plot-map-popup {
    width: 330px;
  }
  .plot-popup-table > div {
    min-height: 33px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .plot-dialog-enter-active,
  .plot-dialog-leave-active,
  .plot-dialog-enter-active.plot-map-popup,
  .plot-dialog-leave-active.plot-map-popup {
    transition: none;
  }
}
</style>
