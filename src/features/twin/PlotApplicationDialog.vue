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
        <h2 id="plot-application-title">{{ plot.label }}规划内容</h2>
        <button type="button" aria-label="关闭地块规划弹窗" @click="$emit('close')">
          ×
        </button>
      </header>

      <dl class="plot-popup-table">
        <div>
          <dt>建设类型</dt>
          <dd><strong>{{ plot.applicationLabel }}</strong></dd>
        </div>
        <div>
          <dt>功能方向</dt>
          <dd>{{ plot.applicationTags.join(' · ') }}</dd>
        </div>
        <div>
          <dt>主要设施</dt>
          <dd>
            {{ plot.applicationScenarios.map((scenario) => scenario.label).join('、') }}
          </dd>
        </div>
      </dl>
    </section>
  </Transition>
</template>

<style scoped>
.plot-map-popup {
  position: absolute;
  z-index: 320;
  width: 390px;
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
  min-height: 52px;
  padding: 9px 12px 9px 16px;
  border-bottom: 1px solid rgba(122, 203, 190, 0.14);
  background: rgba(61, 214, 196, 0.04);
  grid-template-columns: 1fr 28px;
}

.plot-map-popup h2 {
  margin: 0;
  font-size: 15px;
  line-height: 1.35;
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
  font: 18px/1 var(--font-body);
  cursor: pointer;
}

.plot-popup-table {
  margin: 0;
  padding: 12px;
}

.plot-popup-table > div {
  display: grid;
  min-height: 46px;
  border: 1px solid rgba(122, 203, 190, 0.1);
  border-bottom: 0;
  grid-template-columns: 96px 1fr;
}

.plot-popup-table > div:last-child {
  border-bottom: 1px solid rgba(122, 203, 190, 0.1);
}

.plot-popup-table dt,
.plot-popup-table dd {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 9px 10px;
  font-size: 13px;
  line-height: 1.55;
}

.plot-popup-table dt {
  color: var(--text-soft);
  background: rgba(255, 255, 255, 0.035);
  font-size: 12px;
}

.plot-popup-table dd {
  color: var(--text);
  border-left: 1px solid rgba(122, 203, 190, 0.1);
}

.plot-popup-table dd strong {
  color: #ffd28a;
  font-size: 13px;
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
    width: 370px;
  }
  .plot-popup-table > div {
    min-height: 42px;
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
