import { createApp } from 'vue'
import { createPinia } from 'pinia'
import 'leaflet/dist/leaflet.css'
import '@/styles/tokens.css'
import '@/styles/base.css'
import App from '@/app/App.vue'
import router from '@/router'
import { loadRuntimeConfig } from '@/config/runtime'

async function bootstrap() {
  const config = await loadRuntimeConfig()
  const app = createApp(App)
  app.provide('runtimeConfig', config)
  app.use(createPinia())
  app.use(router)
  app.mount('#app')
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : '未知配置错误'
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
    <main class="boot-error">
      <p>GREENTWIN / 启动诊断</p>
      <h1>平台配置未能加载</h1>
      <span>${message}</span>
      <button type="button" onclick="window.location.reload()">重新加载</button>
    </main>`
})
