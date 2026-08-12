import { fileURLToPath, URL } from 'node:url'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { createReportMiddleware } from './server/deepseek-report.mjs'
import { createGovernanceAssistantMiddleware } from './server/governance-assistant.mjs'
import { createDecisionAssistantMiddleware } from './server/decision-assistant.mjs'
import { createSimulationMiddleware } from './server/simulation.mjs'
import { createAgentSimulationMiddleware } from './server/agent-simulation.mjs'
import { createArcGisVectorBasemapMiddleware } from './server/arcgis-vector-basemap.mjs'

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

function agentSimulationApi(env: Record<string, string>): Plugin {
  const middleware = createAgentSimulationMiddleware({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_API_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    blenderExecutable: env.BLENDER_EXECUTABLE,
  })

  return {
    name: 'greentwin-3d-agent-api',
    configureServer(server) {
      server.middlewares.use('/api/agent-simulation', (request, response) => {
        void middleware(request, response)
      })
    },
  }
}

function decisionAssistantApi(env: Record<string, string>): Plugin {
  const middleware = createDecisionAssistantMiddleware({
    apiKey: env.DEEPSEEK_API_KEY,
    baseUrl: env.DEEPSEEK_API_BASE_URL,
    model: env.DEEPSEEK_MODEL,
    timeoutMs: Number(env.DEEPSEEK_TIMEOUT_MS) || 90000,
    anthropicApiKey: env.ANTHROPIC_API_KEY,
    anthropicBaseUrl: env.ANTHROPIC_API_BASE_URL,
    anthropicModel: env.ANTHROPIC_MODEL,
    visionApiKey: env.VISION_API_KEY,
    visionBaseUrl: env.VISION_API_BASE_URL,
    visionModel: env.VISION_MODEL,
    visionProtocol: env.VISION_API_PROTOCOL,
  })

  return {
    name: 'greentwin-decision-assistant-api',
    configureServer(server) {
      server.middlewares.use('/api/assistant/decision', (request, response) => {
        void middleware(request, response)
      })
    },
  }
}

function arcGisVectorBasemapApi(): Plugin {
  const middleware = createArcGisVectorBasemapMiddleware()

  return {
    name: 'greentwin-arcgis-vector-basemap-api',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url || '/', 'http://localhost')
          .pathname
        if (!pathname.startsWith('/api/arcgis/world-streets')) {
          next()
          return
        }
        void middleware(request, response, pathname)
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
      governanceAssistantApi(env),
      decisionAssistantApi(env),
      simulationApi(env),
      agentSimulationApi(env),
      arcGisVectorBasemapApi(),
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
