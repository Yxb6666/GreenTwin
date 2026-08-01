import { inject } from 'vue'
import type { RuntimeConfig } from './runtime'

export function useRuntimeConfig(): Readonly<RuntimeConfig> {
  const config = inject<Readonly<RuntimeConfig>>('runtimeConfig')
  if (!config) throw new Error('运行时配置尚未注入')
  return config
}
