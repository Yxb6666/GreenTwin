import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReportMiddleware } from './deepseek-report.mjs'
import { createGovernanceAssistantMiddleware } from './governance-assistant.mjs'
import { createDecisionAssistantMiddleware } from './decision-assistant.mjs'
import { createSimulationMiddleware } from './simulation.mjs'
import { createAgentSimulationMiddleware } from './agent-simulation.mjs'
import { createArcGisVectorBasemapMiddleware } from './arcgis-vector-basemap.mjs'

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const distDirectory = resolve(projectRoot, 'dist')
const envPath = resolve(projectRoot, '.env.local')

if (existsSync(envPath)) process.loadEnvFile(envPath)

const host = process.env.HOST || '127.0.0.1'
const port = Number(process.env.PORT) || 8080
const reportMiddleware = createReportMiddleware()
const governanceAssistantMiddleware = createGovernanceAssistantMiddleware()
const decisionAssistantMiddleware = createDecisionAssistantMiddleware()
const simulationMiddleware = createSimulationMiddleware()
const agentSimulationMiddleware = createAgentSimulationMiddleware()
const arcGisVectorBasemapMiddleware = createArcGisVectorBasemapMiddleware()
const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
}

function sendText(response, statusCode, text) {
  response.writeHead(statusCode, {
    'Content-Type': 'text/plain; charset=utf-8',
  })
  response.end(text)
}

function serveFile(request, response, filePath) {
  const headers = {
    'Content-Type':
      contentTypes[extname(filePath)] || 'application/octet-stream',
    'Cache-Control': filePath.endsWith('.html')
      ? 'no-cache'
      : 'public, max-age=3600',
  }
  response.writeHead(200, headers)
  if (request.method === 'HEAD') response.end()
  else createReadStream(filePath).pipe(response)
}

function serveApplication(request, response, pathname) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    sendText(response, 405, 'Method Not Allowed')
    return
  }
  if (!existsSync(distDirectory)) {
    sendText(response, 503, '尚未构建前端，请先运行 npm run build')
    return
  }

  const requestedPath = pathname === '/' ? '/index.html' : pathname
  const filePath = resolve(
    distDirectory,
    `.${decodeURIComponent(requestedPath)}`,
  )
  if (
    filePath !== distDirectory &&
    !filePath.startsWith(`${distDirectory}${sep}`)
  ) {
    sendText(response, 403, 'Forbidden')
    return
  }

  if (existsSync(filePath) && statSync(filePath).isFile()) {
    serveFile(request, response, filePath)
    return
  }
  serveFile(request, response, resolve(distDirectory, 'index.html'))
}

const server = createServer(async (request, response) => {
  const url = new URL(
    request.url || '/',
    `http://${request.headers.host || `${host}:${port}`}`,
  )
  if (url.pathname === '/api/reports/sansheng') {
    await reportMiddleware(request, response)
    return
  }
  if (url.pathname === '/api/assistant/governance') {
    await governanceAssistantMiddleware(request, response)
    return
  }
  if (url.pathname === '/api/assistant/decision') {
    await decisionAssistantMiddleware(request, response)
    return
  }
  if (url.pathname.startsWith('/api/simulation/')) {
    await simulationMiddleware(request, response, url.pathname)
    return
  }
  if (url.pathname.startsWith('/api/agent-simulation/')) {
    await agentSimulationMiddleware(request, response, url.pathname)
    return
  }
  if (url.pathname.startsWith('/api/arcgis/world-streets')) {
    await arcGisVectorBasemapMiddleware(request, response, url.pathname)
    return
  }
  serveApplication(request, response, url.pathname)
})

server.listen(port, host, () => {
  console.log(`GreenTwin 服务已启动：http://${host}:${port}`)
})

function shutdown() {
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
