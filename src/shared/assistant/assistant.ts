export type DecisionAssistantValue = string | number | boolean | null
export type DecisionAssistantData = Record<
  string,
  | DecisionAssistantValue
  | DecisionAssistantValue[]
  | Record<string, DecisionAssistantValue>
>

export interface DecisionAssistantContext {
  module: string
  scopeLabel: string
  updatedAt: string
  data: DecisionAssistantData
}

export interface DecisionAssistantResponse {
  answer: string
  evidence: string[]
  suggestions: string[]
  disclaimer: string
  scopeLabel: string
  meta: {
    model: string
    visionModel?: string
    generatedAt: string
  }
}

export interface DecisionAssistantImage {
  name: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
  data: string
}

export interface DecisionAssistantRequest {
  question: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  context: DecisionAssistantContext
  image?: DecisionAssistantImage
}

const allowedImageTypes = new Set<DecisionAssistantImage['mediaType']>([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
])

function readBlob(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('无法读取图片'))
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.readAsDataURL(blob)
  })
}

export async function prepareDecisionAssistantImage(
  file: File,
): Promise<DecisionAssistantImage> {
  if (
    !allowedImageTypes.has(file.type as DecisionAssistantImage['mediaType'])
  ) {
    throw new Error('仅支持 JPEG、PNG、GIF 或 WebP 图片')
  }
  if (file.size > 12 * 1024 * 1024) throw new Error('原始图片不能超过 12 MB')

  let content: Blob = file
  let mediaType = file.type as DecisionAssistantImage['mediaType']
  if ('createImageBitmap' in window) {
    const bitmap = await createImageBitmap(file)
    const pixelScale = Math.sqrt(1_150_000 / (bitmap.width * bitmap.height))
    const edgeScale = 1568 / Math.max(bitmap.width, bitmap.height)
    const scale = Math.min(1, pixelScale, edgeScale)
    if (scale < 1 || file.size > 5 * 1024 * 1024) {
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(bitmap.width * scale))
      canvas.height = Math.max(1, Math.round(bitmap.height * scale))
      const context = canvas.getContext('2d')
      if (!context) {
        bitmap.close()
        throw new Error('当前浏览器无法处理图片')
      }
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      content = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('图片压缩失败'))),
          'image/webp',
          0.88,
        ),
      )
      mediaType = 'image/webp'
    } else {
      bitmap.close()
    }
  }
  if (content.size > 5 * 1024 * 1024)
    throw new Error('压缩后的图片不能超过 5 MB')
  const dataUrl = await readBlob(content)
  const separator = dataUrl.indexOf(',')
  if (separator < 0) throw new Error('图片数据格式不正确')
  return {
    name: file.name.slice(0, 120),
    mediaType,
    data: dataUrl.slice(separator + 1),
  }
}

function isDecisionAssistantResponse(
  value: unknown,
): value is DecisionAssistantResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<DecisionAssistantResponse>
  return Boolean(
    typeof response.answer === 'string' &&
      Array.isArray(response.evidence) &&
      Array.isArray(response.suggestions) &&
      typeof response.disclaimer === 'string' &&
      typeof response.scopeLabel === 'string' &&
      response.meta &&
      typeof response.meta.model === 'string',
  )
}

export async function requestDecisionAssistant(
  endpoint: string,
  timeoutMs: number,
  payload: DecisionAssistantRequest,
): Promise<DecisionAssistantResponse> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const result: unknown = await response.json().catch(() => null)
    if (!response.ok) {
      const message =
        result &&
        typeof result === 'object' &&
        'message' in result &&
        typeof result.message === 'string'
          ? result.message
          : `AI 请求失败（HTTP ${response.status}）`
      throw new Error(message)
    }
    if (!isDecisionAssistantResponse(result))
      throw new Error('AI 返回的数据结构不正确')
    return result
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('AI 分析超时，请稍后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
