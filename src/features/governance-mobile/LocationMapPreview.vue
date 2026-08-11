<script setup lang="ts">
import { onMounted, watch } from 'vue'
import L from 'leaflet'
import { useRuntimeConfig } from '@/config/useRuntimeConfig'
import { useLeafletMap } from '@/gis/leaflet/useLeafletMap'
import { ref } from 'vue'

const props = defineProps<{
  longitude: number | null
  latitude: number | null
}>()

const config = useRuntimeConfig()
const container = ref<HTMLElement | null>(null)
const { map, error, initialize } = useLeafletMap(container)
let locationMarker: L.CircleMarker | null = null

function syncLocation() {
  const mapInstance = map.value
  if (!mapInstance) return
  const hasLocation = props.longitude !== null && props.latitude !== null
  const center: [number, number] = hasLocation
    ? [props.latitude!, props.longitude!]
    : config.map.center

  mapInstance.setView(center, hasLocation ? 14 : config.map.zoom, {
    animate: false,
  })
  locationMarker?.remove()
  locationMarker = null
  if (!hasLocation) return

  locationMarker = L.circleMarker(center, {
    radius: 8,
    color: '#ffffff',
    weight: 3,
    fillColor: '#20a878',
    fillOpacity: 1,
  })
    .bindTooltip('问题位置', {
      direction: 'top',
      permanent: false,
    })
    .addTo(mapInstance)
}

onMounted(async () => {
  await initialize(
    config.supermap.leafletSdkUrl,
    config.supermap.mapServices.base,
    config.map.center,
    config.map.zoom,
    config.map.crs,
  )
  const mapInstance = map.value
  if (mapInstance) {
    mapInstance.dragging.disable()
    mapInstance.touchZoom.disable()
    mapInstance.doubleClickZoom.disable()
    mapInstance.scrollWheelZoom.disable()
    mapInstance.boxZoom.disable()
    mapInstance.keyboard.disable()
  }
  syncLocation()
})

watch(
  () => [props.longitude, props.latitude] as const,
  syncLocation,
)
</script>

<template>
  <div class="gm-map-shell">
    <div
      ref="container"
      class="gm-map"
      role="img"
      :aria-label="
        longitude !== null && latitude !== null
          ? `问题位置地图，经度 ${longitude}，纬度 ${latitude}`
          : '问题位置地图，等待定位'
      "
    />
    <span v-if="longitude === null || latitude === null" class="gm-map-empty">
      获取定位后将在地图中标记
    </span>
    <span v-if="error" class="gm-map-error">底图暂不可用，坐标仍可正常提交</span>
  </div>
</template>
