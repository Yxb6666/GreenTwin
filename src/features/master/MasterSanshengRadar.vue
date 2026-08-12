<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from "vue";
import type { DimensionKey, SanshengScores } from "@/features/sansheng/model";

const props = defineProps<{
  areaName: string;
  scope: "county" | "township" | "unavailable";
  scores: SanshengScores;
  referenceScores?: SanshengScores | null;
}>();

const dimensions: Array<{
  key: DimensionKey;
  label: string;
  fullLabel: string;
}> = [
  { key: "ecology", label: "生态", fullLabel: "生态空间" },
  { key: "life", label: "生活", fullLabel: "生活空间" },
  { key: "production", label: "生产", fullLabel: "生产空间" },
];
const center = { x: 126, y: 58 };
const radius = 42;
const displayedValues = ref(scoreValues(props.scores));
const activeTooltip = ref<"current" | "reference" | null>(null);
let animationFrame = 0;

function scoreValues(scores: SanshengScores) {
  return dimensions.map(({ key }) => scores[key]);
}

function point(value: number, index: number, scale = 1) {
  const angle = -Math.PI / 2 + (Math.PI * 2 * index) / dimensions.length;
  const ratio = Math.max(0, Math.min(100, value)) / 100;
  return {
    x: center.x + Math.cos(angle) * radius * ratio * scale,
    y: center.y + Math.sin(angle) * radius * ratio * scale,
  };
}

function points(values: number[], scale = 1) {
  return values
    .map((value, index) => {
      const coordinate = point(value, index, scale);
      return `${coordinate.x},${coordinate.y}`;
    })
    .join(" ");
}

function gridPoints(level: number) {
  return points([100, 100, 100], level);
}

function easeOutCubic(progress: number) {
  return 1 - (1 - progress) ** 3;
}

watch(
  () => scoreValues(props.scores),
  (nextValues) => {
    cancelAnimationFrame(animationFrame);
    const startValues = [...displayedValues.value];
    const startedAt = performance.now();
    const duration = window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches
      ? 0
      : 420;

    const animate = (now: number) => {
      const progress =
        duration === 0 ? 1 : Math.min(1, (now - startedAt) / duration);
      const eased = easeOutCubic(progress);
      displayedValues.value = nextValues.map(
        (value, index) =>
          startValues[index]! + (value - startValues[index]!) * eased,
      );
      if (progress < 1) animationFrame = requestAnimationFrame(animate);
    };

    animationFrame = requestAnimationFrame(animate);
  },
);

onBeforeUnmount(() => cancelAnimationFrame(animationFrame));

const currentPoints = computed(() => points(displayedValues.value));
const referencePoints = computed(() =>
  props.referenceScores ? points(scoreValues(props.referenceScores)) : "",
);
const nodes = computed(() =>
  displayedValues.value.map((value, index) => point(value, index)),
);
const rankedDimensions = computed(() =>
  dimensions
    .map((dimension) => ({
      ...dimension,
      value: props.scores[dimension.key],
    }))
    .sort((a, b) => b.value - a.value),
);
const strongestDimension = computed(() => rankedDimensions.value[0]!);
const weakestDimension = computed(
  () => rankedDimensions.value[rankedDimensions.value.length - 1]!,
);
const currentLegend = computed(() =>
  props.scope === "township"
    ? `当前乡镇（${props.areaName}）`
    : `县域评价（${props.areaName}）`,
);
const tooltipScores = computed(() =>
  activeTooltip.value === "reference" && props.referenceScores
    ? props.referenceScores
    : props.scores,
);
const tooltipTitle = computed(() =>
  activeTooltip.value === "reference" ? "县域参考" : props.areaName,
);
</script>

<template>
  <div class="diagnostic-radar">
    <div class="diagnostic-radar__chart">
      <svg
        viewBox="0 0 252 116"
        role="img"
        :aria-label="`${areaName}三生综合评价雷达图`"
      >
        <polygon
          v-for="level in [0.25, 0.5, 0.75, 1]"
          :key="level"
          :points="gridPoints(level)"
          class="diagnostic-radar__grid"
        />
        <line
          v-for="(_, index) in dimensions"
          :key="index"
          :x1="center.x"
          :y1="center.y"
          :x2="point(100, index).x"
          :y2="point(100, index).y"
          class="diagnostic-radar__axis"
        />

        <polygon
          v-if="referenceScores"
          :points="referencePoints"
          class="diagnostic-radar__reference"
          tabindex="0"
          @pointerenter="activeTooltip = 'reference'"
          @pointerleave="activeTooltip = null"
          @focus="activeTooltip = 'reference'"
          @blur="activeTooltip = null"
        />
        <polygon
          :points="currentPoints"
          class="diagnostic-radar__current"
          tabindex="0"
          @pointerenter="activeTooltip = 'current'"
          @pointerleave="activeTooltip = null"
          @focus="activeTooltip = 'current'"
          @blur="activeTooltip = null"
        />
        <circle
          v-for="(node, index) in nodes"
          :key="dimensions[index]!.key"
          :cx="node.x"
          :cy="node.y"
          r="2.7"
          class="diagnostic-radar__node"
        />

        <g class="diagnostic-radar__label diagnostic-radar__label--top">
          <text x="126" y="5">生态</text>
          <text x="126" y="17" class="diagnostic-radar__score">
            {{ scores.ecology.toFixed(1) }}
          </text>
        </g>
        <g class="diagnostic-radar__label diagnostic-radar__label--left">
          <text x="42" y="94">生产</text>
          <text x="42" y="106" class="diagnostic-radar__score">
            {{ scores.production.toFixed(1) }}
          </text>
        </g>
        <g class="diagnostic-radar__label diagnostic-radar__label--right">
          <text x="210" y="94">生活</text>
          <text x="210" y="106" class="diagnostic-radar__score">
            {{ scores.life.toFixed(1) }}
          </text>
        </g>

        <g class="diagnostic-radar__composite">
          <text x="126" y="51">综合指数</text>
          <text x="126" y="68" class="diagnostic-radar__composite-value">
            {{ scores.composite.toFixed(1) }}
          </text>
        </g>
      </svg>

      <Transition name="tooltip-fade">
        <div
          v-if="activeTooltip"
          class="diagnostic-radar__tooltip"
          role="tooltip"
        >
          <strong>{{ tooltipTitle }}</strong>
          <span>生态 {{ tooltipScores.ecology.toFixed(1) }}</span>
          <span>生活 {{ tooltipScores.life.toFixed(1) }}</span>
          <span>生产 {{ tooltipScores.production.toFixed(1) }}</span>
          <span>综合 {{ tooltipScores.composite.toFixed(1) }}</span>
        </div>
      </Transition>
    </div>

    <div class="diagnostic-radar__footer">
      <div class="diagnostic-radar__legend" aria-label="雷达图图例">
        <span><i class="is-current" />{{ currentLegend }}</span>
        <span v-if="referenceScores"><i class="is-reference" />县域参考</span>
      </div>
      <div class="diagnostic-radar__diagnosis">
        <span><em>优势</em>{{ strongestDimension.fullLabel }}</span>
        <span><em>短板</em>{{ weakestDimension.fullLabel }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.diagnostic-radar {
  display: grid;
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
}

.diagnostic-radar__chart {
  position: relative;
  min-height: 0;
}

.diagnostic-radar__chart svg {
  display: block;
  width: 100%;
  height: 100%;
  min-height: 112px;
  overflow: visible;
}

.diagnostic-radar__grid,
.diagnostic-radar__axis {
  fill: none;
  stroke: rgba(116, 157, 149, 0.22);
  stroke-width: 0.75;
  vector-effect: non-scaling-stroke;
}

.diagnostic-radar__axis {
  stroke: rgba(116, 157, 149, 0.14);
}

.diagnostic-radar__reference {
  fill: rgba(120, 146, 140, 0.025);
  stroke: #78928c;
  stroke-dasharray: 4 3;
  stroke-width: 1.4;
  opacity: 0.76;
  outline: none;
  vector-effect: non-scaling-stroke;
}

.diagnostic-radar__current {
  fill: rgba(61, 214, 196, 0.18);
  stroke: #3dd6c4;
  stroke-linejoin: round;
  stroke-width: 2.6;
  outline: none;
  filter: drop-shadow(0 0 4px rgba(61, 214, 196, 0.16));
  vector-effect: non-scaling-stroke;
}

.diagnostic-radar__current:focus-visible,
.diagnostic-radar__reference:focus-visible {
  stroke: #83eee1;
}

.diagnostic-radar__node {
  fill: #45e0d0;
  stroke: #d9fffa;
  stroke-width: 0.8;
  pointer-events: none;
  vector-effect: non-scaling-stroke;
}

.diagnostic-radar__label text,
.diagnostic-radar__composite text {
  fill: #eef5ee;
  font: 9px var(--font-display);
  text-anchor: middle;
}

.diagnostic-radar__label .diagnostic-radar__score {
  fill: #dcece7;
  font: 600 10px var(--font-data);
}

.diagnostic-radar__composite text {
  fill: #95aaa3;
  font-size: 7.5px;
}

.diagnostic-radar__composite .diagnostic-radar__composite-value {
  fill: #42ded0;
  font: 700 15px var(--font-data);
}

.diagnostic-radar__tooltip {
  position: absolute;
  z-index: 2;
  top: 4px;
  right: 4px;
  display: grid;
  grid-template-columns: repeat(2, auto);
  gap: 2px 8px;
  padding: 6px 8px;
  color: #c7d9d3;
  border: 1px solid rgba(61, 214, 196, 0.3);
  background: rgba(4, 29, 26, 0.94);
  box-shadow: 0 6px 18px rgba(1, 15, 13, 0.38);
  font: 8px var(--font-data);
  pointer-events: none;
}

.diagnostic-radar__tooltip strong {
  color: #edfffb;
  grid-column: 1 / -1;
  font-family: var(--font-display);
}

.diagnostic-radar__footer {
  display: grid;
  gap: 5px;
  padding-top: 4px;
  border-top: 1px solid rgba(74, 126, 114, 0.18);
}

.diagnostic-radar__legend,
.diagnostic-radar__diagnosis {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 13px;
  color: #95aaa3;
  font-size: 8px;
  white-space: nowrap;
}

.diagnostic-radar__legend span,
.diagnostic-radar__diagnosis span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.diagnostic-radar__legend i {
  display: inline-block;
  width: 16px;
  border-top: 2px solid #3dd6c4;
}

.diagnostic-radar__legend i.is-reference {
  border-top: 1px dashed #78928c;
}

.diagnostic-radar__diagnosis {
  justify-content: space-between;
  padding: 0 8px;
  color: #dce9e5;
}

.diagnostic-radar__diagnosis em {
  color: #4ad9c8;
  font-style: normal;
}

.diagnostic-radar__diagnosis span:last-child em {
  color: #d8df8a;
}

.tooltip-fade-enter-active,
.tooltip-fade-leave-active {
  transition: opacity 120ms ease;
}

.tooltip-fade-enter-from,
.tooltip-fade-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .tooltip-fade-enter-active,
  .tooltip-fade-leave-active {
    transition: none;
  }
}
</style>
