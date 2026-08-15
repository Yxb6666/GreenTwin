<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  sceneCanvas: HTMLCanvasElement | null
  plotLabel: string
  plotIndex: number
  plotCount: number
}>()

defineEmits<{
  previous: []
  next: []
}>()

const previewCanvas = ref<HTMLCanvasElement | null>(null)
const previewVideo = ref<HTMLVideoElement | null>(null)
const previewReady = ref(false)

let animationFrame = 0
let lastCaptureAt = 0
let sceneStream: MediaStream | null = null

function captureScene(timestamp: number) {
  animationFrame = window.requestAnimationFrame(captureScene)
  if (timestamp - lastCaptureAt < 180) return
  const source = props.sceneCanvas
  const target = previewCanvas.value
  if (!source || !target || source.width === 0 || source.height === 0) return

  const bounds = target.getBoundingClientRect()
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
  const width = Math.max(1, Math.round(bounds.width * pixelRatio))
  const height = Math.max(1, Math.round(bounds.height * pixelRatio))
  if (target.width !== width || target.height !== height) {
    target.width = width
    target.height = height
  }

  const context = target.getContext('2d')
  if (!context) return
  try {
    context.drawImage(source, 0, 0, width, height)
    previewReady.value = true
    lastCaptureAt = timestamp
  } catch {
    previewReady.value = false
  }
}

async function connectSceneStream() {
  sceneStream?.getTracks().forEach((track) => track.stop())
  sceneStream = null
  const source = props.sceneCanvas
  const video = previewVideo.value
  if (!source || !video || typeof source.captureStream !== 'function') return

  sceneStream = source.captureStream(8)
  video.srcObject = sceneStream
  try {
    await video.play()
  } catch {
    return
  }
  previewReady.value = video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
}

onMounted(async () => {
  await nextTick()
  await connectSceneStream()
  animationFrame = window.requestAnimationFrame(captureScene)
})

watch(() => props.sceneCanvas, () => void connectSceneStream())

onBeforeUnmount(() => {
  window.cancelAnimationFrame(animationFrame)
  sceneStream?.getTracks().forEach((track) => track.stop())
  sceneStream = null
})
</script>

<template>
  <section class="plot-preview panel-frame" aria-label="地块场景与区位预览">
    <div class="scene-preview">
      <video
        ref="previewVideo"
        muted
        autoplay
        playsinline
        aria-hidden="true"
        @loadeddata="previewReady = true"
      />
      <canvas ref="previewCanvas" aria-hidden="true" />
      <div v-if="!previewReady" class="preview-placeholder">
        <i />
        <span>三维场景同步中</span>
      </div>
      <div class="scene-title">
        <strong>{{ plotLabel }}</strong>
      </div>
      <button
        type="button"
        class="slide-button slide-button--previous"
        aria-label="查看上一地块"
        @click="$emit('previous')"
      >
        ‹
      </button>
      <button
        type="button"
        class="slide-button slide-button--next"
        aria-label="查看下一地块"
        @click="$emit('next')"
      >
        ›
      </button>
      <span class="live-badge"
        ><i /> {{ plotIndex + 1 }} / {{ plotCount }} 地块</span
      >
    </div>

  </section>
</template>

<style scoped>
.plot-preview {
  display: grid;
  min-height: 0;
  padding: 8px;
  gap: 7px;
  overflow: hidden;
  background: rgba(8, 23, 23, 0.92);
  grid-template-rows: minmax(0, 1fr);
}

.scene-preview {
  position: relative;
  min-height: 0;
  overflow: hidden;
  border: 1px solid rgba(122, 203, 190, 0.17);
  border-radius: 7px;
  background: #081312;
}

.scene-preview canvas,
.scene-preview video {
  width: 100%;
  height: 100%;
}

.scene-preview canvas,
.scene-preview video {
  position: absolute;
  inset: 0;
  display: block;
  object-fit: cover;
}

.scene-preview video {
  z-index: 1;
}

.scene-preview::after {
  position: absolute;
  z-index: 2;
  inset: 0;
  pointer-events: none;
  content: '';
  box-shadow: inset 0 0 22px rgba(0, 0, 0, 0.3);
}

.scene-title,
.live-badge {
  position: absolute;
  z-index: 4;
  backdrop-filter: blur(7px);
}

.scene-title {
  top: 0;
  right: 0;
  left: 0;
  display: grid;
  min-height: 31px;
  padding: 5px 42px;
  place-content: center;
  color: #f4fffd;
  text-align: center;
  background: linear-gradient(
    180deg,
    rgba(2, 12, 12, 0.78),
    rgba(2, 12, 12, 0.38)
  );
}

.scene-title strong {
  overflow: hidden;
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slide-button {
  position: absolute;
  z-index: 5;
  top: 50%;
  display: grid;
  width: 25px;
  height: 25px;
  padding: 0 0 2px;
  place-content: center;
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 50%;
  background: rgba(3, 14, 14, 0.56);
  font: 20px/1 var(--font-body);
  cursor: pointer;
  transform: translateY(-50%);
  transition: 140ms ease;
}

.slide-button:hover {
  color: var(--cyan);
  border-color: rgba(61, 214, 196, 0.58);
  background: rgba(3, 25, 23, 0.82);
}

.slide-button--previous {
  left: 7px;
}

.slide-button--next {
  right: 7px;
}

.live-badge {
  right: 7px;
  bottom: 6px;
  display: flex;
  align-items: center;
  padding: 3px 6px;
  gap: 4px;
  color: rgba(238, 248, 245, 0.78);
  border: 1px solid rgba(122, 203, 190, 0.18);
  border-radius: 99px;
  background: rgba(3, 14, 14, 0.64);
  font-size: 7px;
}

.live-badge i {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--cyan);
  box-shadow: 0 0 6px var(--cyan);
}

.preview-placeholder {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 7px;
  color: var(--text-soft);
  background: radial-gradient(
    circle,
    rgba(61, 214, 196, 0.08),
    transparent 58%
  );
  font-size: 8px;
}

.preview-placeholder i {
  width: 20px;
  height: 20px;
  border: 1px solid rgba(61, 214, 196, 0.18);
  border-top-color: var(--cyan);
  border-radius: 50%;
  animation: preview-spin 1.1s linear infinite;
}

@keyframes preview-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview-placeholder i {
    animation: none;
  }
}
</style>
