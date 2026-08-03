import { beforeEach, describe, expect, it } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAuthStore } from '@/features/auth/auth'

describe('账户认证状态', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('注册后建立会话，并能在刷新状态后恢复', async () => {
    const auth = useAuthStore()
    const result = await auth.register('planner01', 'GreenTwin2026')

    expect(result.success).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.username).toBe('planner01')

    setActivePinia(createPinia())
    const restoredAuth = useAuthStore()
    expect(restoredAuth.isAuthenticated).toBe(true)
    expect(restoredAuth.username).toBe('planner01')
  })

  it('退出后拒绝错误密码，并允许正确密码重新登录', async () => {
    const auth = useAuthStore()
    await auth.register('operator', 'Village2026')
    auth.logout()

    expect((await auth.login('operator', 'wrong-password')).success).toBe(false)
    expect(auth.isAuthenticated).toBe(false)
    expect((await auth.login('operator', 'Village2026')).success).toBe(true)
    expect(auth.isAuthenticated).toBe(true)
  })

  it('校验账户格式、密码长度和重复账户', async () => {
    const auth = useAuthStore()

    expect((await auth.register('a', 'GreenTwin2026')).message).toContain(
      '2–24',
    )
    expect((await auth.register('valid-user', 'short')).message).toContain(
      '8–64',
    )
    expect((await auth.register('valid-user', 'GreenTwin2026')).success).toBe(
      true,
    )
    expect(
      (await auth.register('valid-user', 'Another2026')).message,
    ).toContain('已存在')
  })

  it('只记住账户名称，不记录密码', () => {
    const auth = useAuthStore()
    auth.rememberUsername('planner01')

    expect(auth.getRememberedUsername()).toBe('planner01')
    expect(JSON.stringify(localStorage)).not.toContain('GreenTwin2026')

    auth.rememberUsername(null)
    expect(auth.getRememberedUsername()).toBe('')
  })
})
