import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from 'vue'

export interface FloatingPosition {
  x: number
  y: number
}

export interface PanelRect extends FloatingPosition {
  width: number
  height: number
}

interface ViewportSize {
  width: number
  height: number
}

export type ResizeDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

const NO_DRAG_SELECTOR = 'button,input,textarea,select,a,[data-no-drag]'
const LEGACY_PANEL_POSITION_KEY = 'greentwin-ai-assistant-position'

export const AI_ASSISTANT_LAUNCHER_KEY = 'greentwin.ai.launcher.v1'
export const AI_ASSISTANT_PANEL_KEY = 'greentwin.ai.panel.v1'
export const AI_ASSISTANT_VIEWPORT_MARGIN = 16
export const AI_ASSISTANT_MIN_WIDTH = 360
export const AI_ASSISTANT_MIN_HEIGHT = 420
export const AI_ASSISTANT_DRAG_THRESHOLD = 6
export const AI_ASSISTANT_RESIZE_DIRECTIONS: ResizeDirection[] = [
  'n',
  'ne',
  'e',
  'se',
  's',
  'sw',
  'w',
  'nw',
]

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(Math.max(value, minimum), maximum)
}

export function clampPanelPosition(
  position: FloatingPosition,
  panel: ViewportSize,
  viewport: ViewportSize,
  margin = AI_ASSISTANT_VIEWPORT_MARGIN,
): FloatingPosition {
  const maxX = Math.max(margin, viewport.width - panel.width - margin)
  const maxY = Math.max(margin, viewport.height - panel.height - margin)

  return {
    x: clamp(position.x, margin, maxX),
    y: clamp(position.y, margin, maxY),
  }
}

export function clampPanelRect(
  rect: PanelRect,
  viewport: ViewportSize,
  margin = AI_ASSISTANT_VIEWPORT_MARGIN,
): PanelRect {
  const availableWidth = Math.max(0, viewport.width - margin * 2)
  const availableHeight = Math.max(0, viewport.height - margin * 2)
  const minimumWidth = Math.min(AI_ASSISTANT_MIN_WIDTH, availableWidth)
  const minimumHeight = Math.min(AI_ASSISTANT_MIN_HEIGHT, availableHeight)
  const width = clamp(rect.width, minimumWidth, availableWidth)
  const height = clamp(rect.height, minimumHeight, availableHeight)
  const position = clampPanelPosition(rect, { width, height }, viewport, margin)

  return { ...position, width, height }
}

export function resizePanelRect(
  start: PanelRect,
  direction: ResizeDirection,
  delta: FloatingPosition,
  viewport: ViewportSize,
  margin = AI_ASSISTANT_VIEWPORT_MARGIN,
): PanelRect {
  const initial = clampPanelRect(start, viewport, margin)
  const minimumWidth = Math.min(
    AI_ASSISTANT_MIN_WIDTH,
    Math.max(0, viewport.width - margin * 2),
  )
  const minimumHeight = Math.min(
    AI_ASSISTANT_MIN_HEIGHT,
    Math.max(0, viewport.height - margin * 2),
  )
  let left = initial.x
  let right = initial.x + initial.width
  let top = initial.y
  let bottom = initial.y + initial.height

  if (direction.includes('e'))
    right = clamp(right + delta.x, left + minimumWidth, viewport.width - margin)
  if (direction.includes('w'))
    left = clamp(left + delta.x, margin, right - minimumWidth)
  if (direction.includes('s'))
    bottom = clamp(
      bottom + delta.y,
      top + minimumHeight,
      viewport.height - margin,
    )
  if (direction.includes('n'))
    top = clamp(top + delta.y, margin, bottom - minimumHeight)

  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  }
}

function readStoredObject(storageKey: string): Record<string, unknown> | null {
  try {
    const value = localStorage.getItem(storageKey)
    if (!value) return null
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object'
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

function readStoredPosition(storageKey: string): FloatingPosition | null {
  const value = readStoredObject(storageKey)
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y))
    return null
  return { x: Number(value.x), y: Number(value.y) }
}

function readStoredPanelRect(storageKey: string): PanelRect | null {
  const value = readStoredObject(storageKey)
  if (
    !value ||
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.width) ||
    !Number.isFinite(value.height)
  )
    return null
  return {
    x: Number(value.x),
    y: Number(value.y),
    width: Number(value.width),
    height: Number(value.height),
  }
}

function writeStoredValue(storageKey: string, value: object) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value))
  } catch {
    // The floating UI remains usable when storage is unavailable.
  }
}

function removeStoredValue(storageKey: string) {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // The default layout remains available when storage is unavailable.
  }
}

function isPrimaryPointer(event: PointerEvent) {
  return (
    event.isPrimary && (event.pointerType !== 'mouse' || event.button === 0)
  )
}

function releasePointer(event: PointerEvent) {
  const target = event.currentTarget as HTMLElement
  if (target.hasPointerCapture?.(event.pointerId))
    target.releasePointerCapture(event.pointerId)
}

export function useDraggablePanel(
  isOpen: Ref<boolean>,
  options?: { storagePrefix?: string },
) {
  const storagePrefix = options?.storagePrefix ?? 'greentwin.ai'
  const launcherKey = `${storagePrefix}.launcher.v1`
  const panelKey = `${storagePrefix}.panel.v1`
  const launcherRef = ref<HTMLButtonElement | null>(null)
  const panelRef = ref<HTMLElement | null>(null)
  const launcherPosition = ref<FloatingPosition | null>(null)
  const panelRect = ref<PanelRect | null>(null)
  const isLauncherDragging = ref(false)
  const isDragging = ref(false)
  const isResizing = ref(false)

  let launcherPointerId: number | null = null
  let launcherPointerStart = { x: 0, y: 0 }
  let launcherStart = { x: 0, y: 0 }
  let suppressLauncherClick = false
  let suppressClickTimer: number | null = null
  let panelPointerId: number | null = null
  let panelPointerStart = { x: 0, y: 0 }
  let panelStart: PanelRect | null = null
  let resizeDirection: ResizeDirection | null = null
  let previousBodyUserSelect: string | null = null

  const launcherStyle = computed(() => {
    if (!launcherPosition.value) return undefined
    return {
      left: `${launcherPosition.value.x}px`,
      top: `${launcherPosition.value.y}px`,
      right: 'auto',
      bottom: 'auto',
    }
  })

  const panelStyle = computed(() => {
    if (!panelRect.value) return undefined
    return {
      left: `${panelRect.value.x}px`,
      top: `${panelRect.value.y}px`,
      right: 'auto',
      bottom: 'auto',
      width: `${panelRect.value.width}px`,
      height: `${panelRect.value.height}px`,
    }
  })

  function currentViewport(): ViewportSize {
    return { width: window.innerWidth, height: window.innerHeight }
  }

  function setInteractionSelection(active: boolean) {
    if (active && previousBodyUserSelect === null) {
      previousBodyUserSelect = document.body.style.userSelect
      document.body.style.userSelect = 'none'
      return
    }
    if (!active && previousBodyUserSelect !== null) {
      document.body.style.userSelect = previousBodyUserSelect
      previousBodyUserSelect = null
    }
  }

  function launcherSize(): ViewportSize | null {
    if (!launcherRef.value) return null
    const rect = launcherRef.value.getBoundingClientRect()
    return {
      width: launcherRef.value.offsetWidth || rect.width,
      height: launcherRef.value.offsetHeight || rect.height,
    }
  }

  function panelDefaultRect(): PanelRect | null {
    const panel = panelRef.value
    if (!panel) return null
    const boundingRect = panel.getBoundingClientRect()
    const width = panel.offsetWidth || boundingRect.width
    const height = panel.offsetHeight || boundingRect.height
    return clampPanelRect(
      {
        x: panel.offsetLeft,
        y: panel.offsetTop,
        width,
        height,
      },
      currentViewport(),
    )
  }

  function restoreLauncherPosition() {
    const size = launcherSize()
    if (!size) return
    const stored = readStoredPosition(launcherKey)
    if (!stored) {
      removeStoredValue(launcherKey)
      return
    }
    launcherPosition.value = clampPanelPosition(stored, size, currentViewport())
    writeStoredValue(launcherKey, launcherPosition.value)
  }

  function restorePanelRect() {
    const defaultRect = panelDefaultRect()
    if (!defaultRect) return
    if (panelRect.value) {
      panelRect.value = clampPanelRect(panelRect.value, currentViewport())
      return
    }

    const stored = readStoredPanelRect(panelKey)
    if (stored) {
      panelRect.value = clampPanelRect(stored, currentViewport())
      writeStoredValue(panelKey, panelRect.value)
      return
    }

    const legacyPosition = readStoredPosition(LEGACY_PANEL_POSITION_KEY)
    panelRect.value = legacyPosition
      ? clampPanelRect({ ...defaultRect, ...legacyPosition }, currentViewport())
      : defaultRect
    removeStoredValue(panelKey)
    if (legacyPosition)
      writeStoredValue(panelKey, panelRect.value)
    removeStoredValue(LEGACY_PANEL_POSITION_KEY)
  }

  function onLauncherClick(event: MouseEvent) {
    event.stopPropagation()
    if (suppressLauncherClick) {
      event.preventDefault()
      suppressLauncherClick = false
      return
    }
    isOpen.value = !isOpen.value
  }

  function onLauncherPointerDown(event: PointerEvent) {
    if (!isPrimaryPointer(event) || !launcherRef.value) return
    const size = launcherSize()
    if (!size) return
    const start = launcherPosition.value ?? {
      x: launcherRef.value.offsetLeft,
      y: launcherRef.value.offsetTop,
    }
    launcherPointerId = event.pointerId
    launcherPointerStart = { x: event.clientX, y: event.clientY }
    launcherStart = clampPanelPosition(start, size, currentViewport())
    isLauncherDragging.value = false
    const launcher = event.currentTarget as HTMLElement
    launcher.setPointerCapture?.(event.pointerId)
    event.stopPropagation()
  }

  function onLauncherPointerMove(event: PointerEvent) {
    if (event.pointerId !== launcherPointerId) return
    const size = launcherSize()
    if (!size) return
    const delta = {
      x: event.clientX - launcherPointerStart.x,
      y: event.clientY - launcherPointerStart.y,
    }
    if (
      !isLauncherDragging.value &&
      Math.hypot(delta.x, delta.y) <= AI_ASSISTANT_DRAG_THRESHOLD
    )
      return

    if (!isLauncherDragging.value) {
      isLauncherDragging.value = true
      setInteractionSelection(true)
    }
    launcherPosition.value = clampPanelPosition(
      { x: launcherStart.x + delta.x, y: launcherStart.y + delta.y },
      size,
      currentViewport(),
    )
    event.preventDefault()
    event.stopPropagation()
  }

  function finishLauncherPointer(event: PointerEvent, cancelled = false) {
    if (event.pointerId !== launcherPointerId) return
    if (isLauncherDragging.value && launcherPosition.value) {
      writeStoredValue(launcherKey, launcherPosition.value)
      suppressLauncherClick = !cancelled
      if (suppressClickTimer !== null) window.clearTimeout(suppressClickTimer)
      suppressClickTimer = window.setTimeout(() => {
        suppressLauncherClick = false
        suppressClickTimer = null
      })
    }
    releasePointer(event)
    launcherPointerId = null
    isLauncherDragging.value = false
    setInteractionSelection(false)
    event.stopPropagation()
  }

  function onLauncherPointerEnd(event: PointerEvent) {
    finishLauncherPointer(event)
  }

  function onLauncherPointerCancel(event: PointerEvent) {
    finishLauncherPointer(event, true)
  }

  function onHeaderPointerDown(event: PointerEvent) {
    if (
      !isPrimaryPointer(event) ||
      isResizing.value ||
      (event.target as Element | null)?.closest(NO_DRAG_SELECTOR) ||
      !panelRect.value
    )
      return

    panelPointerId = event.pointerId
    panelPointerStart = { x: event.clientX, y: event.clientY }
    panelStart = { ...panelRect.value }
    isDragging.value = true
    setInteractionSelection(true)
    const header = event.currentTarget as HTMLElement
    header.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  function onHeaderPointerMove(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== panelPointerId || !panelStart)
      return
    const position = clampPanelPosition(
      {
        x: panelStart.x + event.clientX - panelPointerStart.x,
        y: panelStart.y + event.clientY - panelPointerStart.y,
      },
      panelStart,
      currentViewport(),
    )
    panelRect.value = { ...panelStart, ...position }
    event.preventDefault()
    event.stopPropagation()
  }

  function finishPanelDrag(event: PointerEvent) {
    if (!isDragging.value || event.pointerId !== panelPointerId) return
    if (panelRect.value)
      writeStoredValue(panelKey, panelRect.value)
    releasePointer(event)
    panelPointerId = null
    panelStart = null
    isDragging.value = false
    setInteractionSelection(false)
    event.stopPropagation()
  }

  function startResize(direction: ResizeDirection, event: PointerEvent) {
    if (
      !isPrimaryPointer(event) ||
      isDragging.value ||
      isResizing.value ||
      !panelRect.value
    )
      return
    resizeDirection = direction
    panelPointerId = event.pointerId
    panelPointerStart = { x: event.clientX, y: event.clientY }
    panelStart = { ...panelRect.value }
    isResizing.value = true
    setInteractionSelection(true)
    const handle = event.currentTarget as HTMLElement
    handle.setPointerCapture?.(event.pointerId)
    event.preventDefault()
    event.stopPropagation()
  }

  function onResizePointerMove(event: PointerEvent) {
    if (
      !isResizing.value ||
      event.pointerId !== panelPointerId ||
      !panelStart ||
      !resizeDirection
    )
      return
    panelRect.value = resizePanelRect(
      panelStart,
      resizeDirection,
      {
        x: event.clientX - panelPointerStart.x,
        y: event.clientY - panelPointerStart.y,
      },
      currentViewport(),
    )
    event.preventDefault()
    event.stopPropagation()
  }

  function finishResize(event: PointerEvent) {
    if (!isResizing.value || event.pointerId !== panelPointerId) return
    if (panelRect.value)
      writeStoredValue(panelKey, panelRect.value)
    releasePointer(event)
    panelPointerId = null
    panelStart = null
    resizeDirection = null
    isResizing.value = false
    setInteractionSelection(false)
    event.stopPropagation()
  }

  async function resetPosition() {
    removeStoredValue(panelKey)
    removeStoredValue(LEGACY_PANEL_POSITION_KEY)
    panelRect.value = null
    await nextTick()
    panelRect.value = panelDefaultRect()
  }

  function onWindowResize() {
    const launcherDimensions = launcherSize()
    if (launcherPosition.value && launcherDimensions) {
      launcherPosition.value = clampPanelPosition(
        launcherPosition.value,
        launcherDimensions,
        currentViewport(),
      )
      writeStoredValue(launcherKey, launcherPosition.value)
    }
    if (panelRect.value) {
      panelRect.value = clampPanelRect(panelRect.value, currentViewport())
      writeStoredValue(panelKey, panelRect.value)
    }
  }

  function onWindowPointerEnd(event: PointerEvent) {
    finishLauncherPointer(event, event.type === 'pointercancel')
    finishPanelDrag(event)
    finishResize(event)
  }

  function onWindowBlur() {
    if (isLauncherDragging.value && launcherPosition.value)
      writeStoredValue(launcherKey, launcherPosition.value)
    if ((isDragging.value || isResizing.value) && panelRect.value)
      writeStoredValue(panelKey, panelRect.value)
    launcherPointerId = null
    panelPointerId = null
    panelStart = null
    resizeDirection = null
    isLauncherDragging.value = false
    isDragging.value = false
    isResizing.value = false
    setInteractionSelection(false)
  }

  watch(isOpen, async (open) => {
    if (!open) {
      panelPointerId = null
      panelStart = null
      resizeDirection = null
      isDragging.value = false
      isResizing.value = false
      setInteractionSelection(false)
      return
    }
    await nextTick()
    restorePanelRect()
  })

  onMounted(async () => {
    window.addEventListener('resize', onWindowResize)
    window.addEventListener('pointerup', onWindowPointerEnd)
    window.addEventListener('pointercancel', onWindowPointerEnd)
    window.addEventListener('blur', onWindowBlur)
    await nextTick()
    restoreLauncherPosition()
  })
  onBeforeUnmount(() => {
    window.removeEventListener('resize', onWindowResize)
    window.removeEventListener('pointerup', onWindowPointerEnd)
    window.removeEventListener('pointercancel', onWindowPointerEnd)
    window.removeEventListener('blur', onWindowBlur)
    if (suppressClickTimer !== null) window.clearTimeout(suppressClickTimer)
    setInteractionSelection(false)
  })

  return {
    isDragging,
    isLauncherDragging,
    isResizing,
    launcherRef,
    launcherStyle,
    onHeaderPointerDown,
    onHeaderPointerEnd: finishPanelDrag,
    onHeaderPointerMove,
    onLauncherClick,
    onLauncherPointerCancel,
    onLauncherPointerDown,
    onLauncherPointerEnd,
    onLauncherPointerMove,
    onResizePointerEnd: finishResize,
    onResizePointerMove,
    panelRef,
    panelStyle,
    resetPosition,
    resizeDirections: AI_ASSISTANT_RESIZE_DIRECTIONS,
    startResize,
  }
}
