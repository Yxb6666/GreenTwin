<script setup lang="ts">
import { computed } from 'vue'
import {
  clampWeatherValue,
  createWeatherState,
  describeWeatherRisk,
  resolveWeatherMetrics,
  weatherPresets,
  type WeatherKind,
  type WeatherState,
} from './weatherSimulation'

const props = defineProps<{
  modelValue: WeatherState
  nativeEffects: boolean
  open: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WeatherState]
  'update:open': [value: boolean]
  change: [value: WeatherState]
}>()

const metrics = computed(() => resolveWeatherMetrics(props.modelValue))
const risk = computed(() => describeWeatherRisk(props.modelValue))
const particleCount = computed(() =>
  Math.round(12 + clampWeatherValue(props.modelValue.intensity) * 0.6),
)
const particles = Array.from({ length: 72 }, (_, index) => ({
  id: index,
  left: `${(index * 37 + 11) % 101}%`,
  delay: `${-((index * 19) % 31) / 10}s`,
  duration: `${0.65 + ((index * 13) % 16) / 10}s`,
  opacity: 0.35 + ((index * 17) % 50) / 100,
}))
const isPrecipitating = computed(() =>
  ['storm', 'snow'].includes(props.modelValue.kind),
)

function update(value: WeatherState) {
  emit('update:modelValue', value)
  emit('change', value)
}

function selectWeather(kind: WeatherKind) {
  update({
    ...createWeatherState(kind),
    windDirection: props.modelValue.windDirection,
  })
}

function updateNumber(key: 'intensity' | 'windSpeed', event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  update({ ...props.modelValue, [key]: value })
}
</script>

<template>
  <div
    class="weather-simulation"
    :class="[
      `weather--${modelValue.kind}`,
      { 'has-weather': modelValue.kind !== 'clear' },
    ]"
    :style="{
      '--weather-intensity': `${modelValue.intensity / 100}`,
      '--wind-angle': `${modelValue.windDirection}deg`,
    }"
  >
    <div class="weather-tint" aria-hidden="true" />
    <div
      v-if="isPrecipitating && !nativeEffects"
      class="weather-particles"
      aria-hidden="true"
    >
      <i
        v-for="particle in particles.slice(0, particleCount)"
        :key="particle.id"
        :style="{
          left: particle.left,
          animationDelay: particle.delay,
          animationDuration: particle.duration,
          opacity: particle.opacity,
        }"
      />
    </div>
    <div
      v-if="modelValue.kind === 'fog' && !nativeEffects"
      class="weather-fog"
      aria-hidden="true"
    >
      <i /><i /><i />
    </div>

    <Transition name="weather-panel">
      <section
      v-if="open"
      class="weather-panel"
      aria-label="天气模拟"
    >
      <header class="weather-panel__summary">
        <i>{{ metrics.icon }}</i>
        <span
          ><strong>{{ metrics.label }}</strong
          ><small>天气模拟</small></span
        >
        <b>{{ metrics.temperature }}℃</b>
        <button
          type="button"
          class="weather-panel__close"
          aria-label="收起天气模拟"
          title="收起"
          @click="emit('update:open', false)"
        >
          ×
        </button>
      </header>

      <div
        id="weather-panel-controls"
        class="weather-panel__controls"
      >
        <div class="weather-presets" role="group" aria-label="天气类型">
          <button
            v-for="preset in weatherPresets"
            :key="preset.kind"
            type="button"
            :class="{ active: modelValue.kind === preset.kind }"
            :aria-pressed="modelValue.kind === preset.kind"
            @click="selectWeather(preset.kind)"
          >
            <i>{{ preset.icon }}</i
            ><span>{{ preset.label }}</span>
          </button>
        </div>

        <label>
          <span
            >天气强度 <strong>{{ modelValue.intensity }}%</strong></span
          >
          <input
            :value="modelValue.intensity"
            type="range"
            min="0"
            max="100"
            step="1"
            :disabled="modelValue.kind === 'clear'"
            aria-label="天气强度"
            @input="updateNumber('intensity', $event)"
          />
        </label>
        <label>
          <span
            >风速 <strong>{{ modelValue.windSpeed }} m/s</strong></span
          >
          <input
            :value="modelValue.windSpeed"
            type="range"
            min="0"
            max="20"
            step="1"
            aria-label="风速"
            @input="updateNumber('windSpeed', $event)"
          />
        </label>

        <div class="weather-metrics">
          <span
            ><small>降水</small
            ><strong>{{ metrics.precipitation }} mm/h</strong></span
          >
          <span
            ><small>能见度</small
            ><strong
              >{{ (metrics.visibility / 1000).toFixed(1) }} km</strong
            ></span
          >
          <span
            ><small>云量</small><strong>{{ metrics.cloudCover }}%</strong></span
          >
        </div>
        <p>{{ risk }}</p>
      </div>
      </section>
    </Transition>
  </div>
</template>

<style scoped>
.weather-simulation,
.weather-tint,
.weather-particles,
.weather-fog {
  position: absolute;
  z-index: 24;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.weather-tint {
  opacity: calc(var(--weather-intensity) * 0.8);
  background: linear-gradient(
    180deg,
    rgba(45, 67, 75, 0.82),
    rgba(13, 28, 31, 0.24) 70%
  );
  transition:
    opacity 300ms ease,
    background 300ms ease;
}

.weather--snow .weather-tint {
  background: linear-gradient(
    180deg,
    rgba(183, 200, 204, 0.55),
    rgba(122, 150, 153, 0.16)
  );
}

.weather--fog .weather-tint {
  background: rgba(174, 191, 188, 0.55);
}

.weather-particles i {
  position: absolute;
  top: -12%;
  width: 1px;
  height: 28px;
  background: linear-gradient(transparent, rgba(205, 235, 245, 0.9));
  transform: rotate(-12deg);
  animation: rain-fall linear infinite;
}

.weather--storm .weather-particles i {
  width: 2px;
  height: 44px;
  transform: rotate(-18deg);
}

.weather--snow .weather-particles i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: rgba(245, 252, 255, 0.9);
  filter: blur(0.3px);
  animation-name: snow-fall;
}

.weather-fog i {
  position: absolute;
  width: 80%;
  height: 30%;
  border-radius: 50%;
  opacity: calc(0.15 + var(--weather-intensity) * 0.5);
  background: rgba(220, 229, 226, 0.45);
  filter: blur(38px);
  animation: fog-drift 12s ease-in-out infinite alternate;
}
.weather-fog i:nth-child(1) {
  top: 5%;
  left: -20%;
}
.weather-fog i:nth-child(2) {
  top: 38%;
  left: 18%;
  animation-delay: -5s;
}
.weather-fog i:nth-child(3) {
  top: 68%;
  left: -5%;
  animation-delay: -9s;
}

.weather-panel {
  position: absolute;
  z-index: 26;
  top: 188px;
  right: 56px;
  width: 258px;
  pointer-events: auto;
  border: 1px solid rgba(122, 203, 190, 0.26);
  border-radius: 9px;
  background: rgba(5, 16, 17, 0.9);
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.36);
  backdrop-filter: blur(12px);
}
.weather-panel button {
  color: inherit;
  font: inherit;
}
.weather-panel__summary {
  display: grid;
  align-items: center;
  width: 100%;
  min-height: 48px;
  padding: 7px 9px;
  color: var(--text);
  text-align: left;
  grid-template-columns: 28px 1fr auto auto;
  gap: 7px;
}
.weather-panel__summary > i {
  display: grid;
  width: 26px;
  height: 26px;
  place-content: center;
  color: var(--cyan);
  border: 1px solid rgba(61, 214, 196, 0.35);
  border-radius: 50%;
  font: normal 9px var(--font-data);
}
.weather-panel__summary span {
  display: grid;
  gap: 2px;
}
.weather-panel__summary strong {
  font-size: 10px;
}
.weather-panel__summary small {
  color: var(--text-soft);
  font-size: 8px;
}
.weather-panel__summary b {
  color: var(--cyan);
  font: 12px var(--font-data);
}
.weather-panel__close {
  display: grid;
  width: 22px;
  height: 22px;
  padding: 0;
  place-content: center;
  color: var(--text-soft);
  border: 0;
  border-radius: 4px;
  background: transparent;
  font: 14px sans-serif;
  cursor: pointer;
}
.weather-panel__close:hover {
  color: var(--cyan);
  background: rgba(61, 214, 196, 0.1);
}
.weather-panel__controls {
  padding: 0 10px 10px;
  border-top: 1px solid rgba(122, 203, 190, 0.12);
}
.weather-presets {
  display: grid;
  margin: 9px 0;
  grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
  gap: 5px;
}
.weather-presets button {
  display: grid;
  min-width: 0;
  padding: 5px 2px;
  place-items: center;
  gap: 3px;
  color: var(--text-soft);
  border: 1px solid rgba(122, 203, 190, 0.16);
  border-radius: 5px;
  background: rgba(255, 255, 255, 0.025);
  cursor: pointer;
}
.weather-presets button.active {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.55);
  background: rgba(61, 214, 196, 0.11);
}
.weather-presets i {
  font: normal 9px var(--font-data);
}
.weather-presets span {
  font-size: 8px;
}
.weather-panel__controls > label {
  display: grid;
  margin-top: 7px;
  gap: 4px;
}
.weather-panel__controls > label span {
  display: flex;
  color: var(--text-soft);
  font-size: 8px;
}
.weather-panel__controls > label strong {
  margin-left: auto;
  color: var(--cyan);
  font: 8px var(--font-data);
}
.weather-panel__controls input {
  width: 100%;
  height: 3px;
  accent-color: var(--cyan);
  cursor: pointer;
}
.weather-panel__controls input:disabled {
  cursor: not-allowed;
  opacity: 0.35;
}
.weather-metrics {
  display: grid;
  margin-top: 10px;
  grid-template-columns: repeat(3, 1fr);
}
.weather-metrics span {
  display: grid;
  text-align: center;
  gap: 3px;
}
.weather-metrics span + span {
  border-left: 1px solid rgba(122, 203, 190, 0.12);
}
.weather-metrics small {
  color: var(--text-soft);
  font-size: 7px;
}
.weather-metrics strong {
  color: var(--cyan);
  font: 8px var(--font-data);
}
.weather-panel__controls p {
  margin: 8px 0 0;
  padding: 6px 7px;
  color: var(--text-soft);
  border-left: 2px solid var(--amber);
  background: rgba(240, 184, 92, 0.06);
  font-size: 8px;
  line-height: 1.45;
}

@keyframes rain-fall {
  to {
    transform: translate3d(-70px, 120vh, 0) rotate(-12deg);
  }
}
@keyframes snow-fall {
  to {
    transform: translate3d(45px, 115vh, 0) rotate(360deg);
  }
}
@keyframes fog-drift {
  to {
    transform: translateX(45%);
  }
}

.weather-panel-enter-active,
.weather-panel-leave-active {
  transition: 160ms ease;
  transform-origin: top left;
}
.weather-panel-enter-from,
.weather-panel-leave-to {
  opacity: 0;
  transform: translateX(8px) scale(0.96);
}

@media (prefers-reduced-motion: reduce) {
  .weather-particles i,
  .weather-fog i {
    animation-play-state: paused;
  }
}

@media (max-width: 1200px) {
  .weather-panel {
    width: 230px;
  }
}
</style>
