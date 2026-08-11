let sdkPromise: Promise<void> | null = null

export function loadSuperMapWebgl(scriptUrl: string, cssUrl: string) {
  const target = window as typeof window & { Cesium?: unknown; CESIUM_BASE_URL?: string }
  if (target.Cesium) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    const appBaseUrl = new URL(import.meta.env.BASE_URL, window.location.origin)
    const resolvedScriptUrl = new URL(scriptUrl, appBaseUrl)
    const resolvedCssUrl = cssUrl ? new URL(cssUrl, appBaseUrl).href : ''
    target.CESIUM_BASE_URL = new URL('./', resolvedScriptUrl).href

    if (cssUrl && !document.querySelector(`link[data-supermap-webgl="${cssUrl}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = resolvedCssUrl
      link.dataset.supermapWebgl = cssUrl
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = resolvedScriptUrl.href
    script.async = true
    script.dataset.supermapWebgl = 'sdk'
    const timeout = window.setTimeout(() => {
      script.remove()
      sdkPromise = null
      reject(new Error('SuperMap WebGL SDK 加载超时，请检查 SDK 地址和现场网络。'))
    }, 15_000)
    script.onload = () => {
      window.clearTimeout(timeout)
      if (target.Cesium) {
        resolve()
      } else {
        sdkPromise = null
        reject(new Error('SuperMap WebGL SDK 已加载，但未找到 Cesium 全局对象。'))
      }
    }
    script.onerror = () => {
      window.clearTimeout(timeout)
      sdkPromise = null
      reject(new Error('SuperMap WebGL SDK 加载失败，请检查 SDK 地址和网络连接。'))
    }
    document.head.appendChild(script)
  })

  return sdkPromise
}
