import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue'

interface PanelPosition {
  x: number
  y: number
}

interface PanelSize {
  width: number
  height: number
}

const NO_DRAG_SELECTOR = 'button,input,textarea,select,a,[data-no-drag]'

export const AI_ASSISTANT_POSITION_KEY = 'greentwin-ai-assistant-position'
export const AI_ASSISTANT_VIEWPORT_MARGIN = 16

export function clampPanelPosition(
  position: PanelPosition,
  panel: PanelSize,
  viewport: PanelSize,
  margin = AI_ASSISTANT_VIEWPORT_MARGIN,
): PanelPosition {
  const maxX = Math.max(margin, viewport.width - panel.width - margin)
  const maxY = Math.max(margin, viewport.height - panel.height - margin)

  return {
    x: Math.min(Math.max(position.x, margin), maxX),
    y: Math.min(Math.max(position.y, margin), maxY),
  }
}

function readStoredPosition(storageKey: string): PanelPosition | null {
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) return null
    const parsed = JSON.parse(value) as Partial<PanelPosition>
    if (!Number.isFinite(parsed.x) || !Number.isFinite(parsed.y)) return null
    return { x: Number(parsed.x), y: Number(parsed.y) }
  } catch {
    return null
  }
}

function writeStoredPosition(storageKey: string, position: PanelPosition) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(position))
  } catch {
    // localStorage may be unavailable in privacy-restricted browser contexts.
  }
}

function removeStoredPosition(storageKey: string) {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // The default position still works when storage is unavailable.
  }
}

export function useDraggablePanel(
  isOpen: Ref<boolean>,
  storageKey = AI_ASSISTANT_POSITION_KEY,
) {
  const panelRef = ref<HTMLElement | null>(null)
  const position = ref<PanelPosition | null>(null)
  const isDragging = ref(false)
  let activePointerId: number | null = null
  let pointerStart = { x: 0, y: 0 }
  let panelStart = { x: 0, y: 0 }
  let hasMoved = false

  const panelStyle = computed(() => {
    if (!position.value) return undefined
    return {
      left: `${position.value.x}px`,
      top: `${position.value.y}px`,
      right: 'auto',
      bottom: 'auto',
    }
  })

  function panelSize(): PanelSize | null {
    if (!panelRef.value) return null
    const rect = panelRef.value.getBoundingClientRect()
    return {
      width: panelRef.value.offsetWidth || rect.width,
      height: panelRef.value.offsetHeight || rect.height,
    }
  }

  function currentViewport(): PanelSize {
    return { width: window.innerWidth, height: window.innerHeight }
  }

  function restorePosition() {
    const size = panelSize()
    const stored = readStoredPosition(storageKey)
    if (!size || !stored) return

    const clamped = clampPanelPosition(stored, size, currentViewport())
    const isFullyVisible = clamped.x === stored.x && clamped.y === stored.y
    if (!isFullyVisible) {
      position.value = null
      removeStoredPosition(storageKey)
      return
    }
    position.value = stored
  }

  function clampCurrentPosition() {
    if (!position.value) return
    const size = panelSize()
    if (!size) return
    position.value = clampPanelPosition(position.value, size, currentViewport())
    writeStoredPosition(storageKey, position.value)
  }

  function resetPosition() {
    position.value = null
    removeStoredPosition(storageKey)
  }

  function onHeaderPointerDown(event: PointerEvent) {
    if (
      !event.isPrimary ||
      (event.pointerType === 'mouse' && event.button !== 0) ||
      (event.target as Element | null)?.closest(NO_DRAG_SELECTOR)
    )
      return

    const panel = panelRef.value
    if (!panel) return
    const rect = panel.getBoundingClientRect()
    activePointerId = event.pointerId
    pointerStart = { x: event.clientX, y: event.clientY }
    panelStart = { x: rect.left, y: rect.top }
    hasMoved = false
    isDragging.value = true
    const header = event.currentTarget as HTMLElement
    header.setPointerCapture?.(event.pointerId)
    event.preventDefault()
  }

  function onHeaderPointerMove(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== activePointerId) return
    const size = panelSize()
    if (!size) return
    const deltaX = event.clientX - pointerStart.x
    const deltaY = event.clientY - pointerStart.y
    if (deltaX === 0 && deltaY === 0) return
    hasMoved = true
    position.value = clampPanelPosition(
      { x: panelStart.x + deltaX, y: panelStart.y + deltaY },
      size,
      currentViewport(),
    )
  }

  function onHeaderPointerEnd(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== activePointerId) return
    if (hasMoved && position.value)
      writeStoredPosition(storageKey, position.value)
    const header = event.currentTarget as HTMLElement
    header.releasePointerCapture?.(event.pointerId)
    activePointerId = null
    isDragging.value = false
    hasMoved = false
  }

  function onWindowResize() {
    clampCurrentPosition()
  }

  watch(isOpen, async (open) => {
    if (!open) return
    await nextTick()
    restorePosition()
  })

  onMounted(() => window.addEventListener('resize', onWindowResize))
  onBeforeUnmount(() => window.removeEventListener('resize', onWindowResize))

  return {
    isDragging,
    onHeaderPointerDown,
    onHeaderPointerEnd,
    onHeaderPointerMove,
    panelRef,
    panelStyle,
    resetPosition,
  }
}
