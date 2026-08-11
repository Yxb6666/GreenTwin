import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { createReportMiddleware } from './server/deepseek-report.mjs'
import { createGovernanceIssuesMiddleware } from './server/governance-issues.mjs'
import { createGovernanceAssistantMiddleware } from './server/governance-assistant.mjs'
import { createSimulationMiddleware } from './server/simulation.mjs'

function localHttpsOptions() {
  const certificatePath = fileURLToPath(
    new URL('./.cert/greentwin-dev.pem', import.meta.url),
  )
  const keyPath = fileURLToPath(
    new URL('./.cert/greentwin-dev-key.pem', import.meta.url),
  )

  if (!existsSync(certificatePath) || !existsSync(keyPath)) return undefined

  return {
    cert: readFileSync(certificatePath),
    key: readFileSync(keyPath),
  }
}

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

function governanceIssuesMockApi(): Plugin {
  return {
    name: 'greentwin-governance-issues-mock-api',
    apply: 'serve',
    configureServer(server) {
      const middleware = createGovernanceIssuesMiddleware({
        dataPath: fileURLToPath(
          new URL(
            './public/data/governance/governance-issues.geojson',
            import.meta.url,
          ),
        ),
      })
      server.middlewares.use((request, response, next) => {
        void middleware(request, response, next)
      })
    },
  }
}

function governanceAssistantApi(env: Record<string, string>): Plugin {
  const middleware = createGovernanceAssistantMiddleware({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_API_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS) || 90000,
  })

  return {
    name: 'greentwin-governance-assistant-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant/governance', (request, response) => {
        void middleware(request, response)
      })
    },
  }
}

function simulationApi(env: Record<string, string>): Plugin {
  const middleware = createSimulationMiddleware({
    blenderExecutable: env.BLENDER_EXECUTABLE,
  })

  return {
    name: 'greentwin-blender-simulation-api',
    configureServer(server) {
      server.middlewares.use('/api/simulation', (request, response) => {
        void middleware(request, response)
      })
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      host: '0.0.0.0',
      port: 5173,
      strictPort: true,
      https: localHttpsOptions(),
    },
    plugins: [
      vue(),
      deepseekReportApi(env),
      governanceIssuesMockApi(),
      governanceAssistantApi(env),
      simulationApi(env),
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
