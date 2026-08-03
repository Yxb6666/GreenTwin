import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { createReportMiddleware } from './server/deepseek-report.mjs'

function deepseekReportApi(env: Record<string, string>): Plugin {
  const middleware = createReportMiddleware({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_API_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS) || 90000,
  })

  return {
    name: 'greentwin-deepseek-report-api',
    configureServer(server) {
      server.middlewares.use('/api/reports/sansheng', (request, response) => {
        void middleware(request, response)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [
      vue(),
      deepseekReportApi(env),
      viteStaticCopy({
        targets: [
          {
            src: 'node_modules/@supermap/iclient3d-webgl/Cesium/**/*',
            dest: 'supermap3d',
            rename: { stripBase: 4 },
          },
        ],
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      target: 'es2022',
      chunkSizeWarningLimit: 1400,
    },
  }
})
