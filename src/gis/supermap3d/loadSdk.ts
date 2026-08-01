let sdkPromise: Promise<void> | null = null

export function loadSuperMapWebgl(scriptUrl: string, cssUrl: string) {
  const target = window as typeof window & { Cesium?: unknown }
  if (target.Cesium) return Promise.resolve()
  if (sdkPromise) return sdkPromise

  sdkPromise = new Promise<void>((resolve, reject) => {
    if (cssUrl && !document.querySelector(`link[data-supermap-webgl="${cssUrl}"]`)) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = cssUrl
      link.dataset.supermapWebgl = cssUrl
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = scriptUrl
    script.async = true
    script.dataset.supermapWebgl = 'sdk'
    const timeout = window.setTimeout(() => {
      script.remove()
      sdkPromise = null
      reject(new Error('SuperMap WebGL SDK 加载超时，请检查 SDK 地址和现场网络。'))
    }, 15_000)
    script.onload = () => {
      window.clearTimeout(timeout)
      resolve()
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
