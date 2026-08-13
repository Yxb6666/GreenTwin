import L from 'leaflet'

export interface LeafletSuperMapNamespace {
  tiledMapLayer: (url: string, options?: L.TileLayerOptions & { transparent?: boolean }) => L.TileLayer
  ImageTileLayer: new (
    url: string,
    options: L.TileLayerOptions & {
      collectionId: string
      renderingRule: Record<string, unknown>
      transparent?: boolean
      cacheEnabled?: boolean
      format?: 'png' | 'jpg' | 'webp'
    },
  ) => L.TileLayer
}

export type LeafletWithSuperMap = typeof L & { supermap?: LeafletSuperMapNamespace }

let sdkPromise: Promise<LeafletWithSuperMap> | null = null

export function loadSuperMapLeaflet(scriptUrl: string) {
  const target = window as typeof window & { L?: LeafletWithSuperMap }
  target.L = L as LeafletWithSuperMap
  if (target.L.supermap?.tiledMapLayer && target.L.supermap.ImageTileLayer) return Promise.resolve(target.L)
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<LeafletWithSuperMap>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.dataset.supermapLeaflet = 'sdk'
    const timeout = window.setTimeout(() => {
      script.remove()
      sdkPromise = null
      reject(new Error('SuperMap iClient Leaflet SDK 加载超时，请检查 SDK 地址和现场网络。'))
    }, 15_000)
    script.onload = () => {
      window.clearTimeout(timeout)
      if (!target.L?.supermap?.tiledMapLayer || !target.L.supermap.ImageTileLayer) {
        sdkPromise = null
        reject(new Error('SuperMap iClient Leaflet SDK 已加载，但未找到地图或影像图层接口。'))
        return
      }
      resolve(target.L)
    }
    script.onerror = () => {
      window.clearTimeout(timeout)
      sdkPromise = null
      reject(new Error('SuperMap iClient Leaflet SDK 加载失败，请检查 SDK 地址。'))
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}
