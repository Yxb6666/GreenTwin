import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

const ACCOUNTS_KEY = 'greentwin.accounts.v1'
const SESSION_KEY = 'greentwin.session.v1'
const REMEMBERED_ACCOUNT_KEY = 'greentwin.remembered-account.v1'

interface StoredAccount {
  username: string
  salt: string
  passwordHash: string
  createdAt: string
}

interface StoredSession {
  username: string
}

export interface AuthResult {
  success: boolean
  message: string
}

function getStorage(): Storage | null {
  return typeof window === 'undefined' ? null : window.localStorage
}

function readJson<T>(key: string, fallback: T): T {
  const storage = getStorage()
  if (!storage) return fallback

  try {
    const value = storage.getItem(key)
    return value ? (JSON.parse(value) as T) : fallback
  } catch {
    storage.removeItem(key)
    return fallback
  }
}

function writeJson(key: string, value: unknown) {
  getStorage()?.setItem(key, JSON.stringify(value))
}

function readAccounts(): Record<string, StoredAccount> {
  const accounts = readJson<unknown>(ACCOUNTS_KEY, {})
  return accounts && typeof accounts === 'object'
    ? (accounts as Record<string, StoredAccount>)
    : {}
}

function normalizeUsername(username: string) {
  return username.trim()
}

function createSalt() {
  const bytes = new Uint8Array(16)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
    '',
  )
}

async function hashPassword(password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${password}`)
  const digest = await globalThis.crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('')
}

function validateCredentials(
  username: string,
  password: string,
): AuthResult | null {
  if (!username || !password)
    return { success: false, message: '请填写账号和密码' }
  if (username.length < 2 || username.length > 24) {
    return { success: false, message: '账号长度应为 2–24 个字符' }
  }
  if (!/^[\p{L}\p{N}_-]+$/u.test(username)) {
    return {
      success: false,
      message: '账号只能包含文字、数字、下划线或短横线',
    }
  }
  if (password.length < 8 || password.length > 64) {
    return { success: false, message: '密码长度应为 8–64 个字符' }
  }
  return null
}

export const useAuthStore = defineStore('auth', () => {
  const username = ref('')
  const isAuthenticated = computed(() => username.value.length > 0)

  function establishSession(accountName: string) {
    username.value = accountName
    writeJson(SESSION_KEY, { username: accountName } satisfies StoredSession)
  }

  function restoreSession() {
    const session = readJson<Partial<StoredSession>>(SESSION_KEY, {})
    const accounts = readAccounts()

    if (session.username && accounts[session.username]) {
      username.value = session.username
      return true
    }

    username.value = ''
    getStorage()?.removeItem(SESSION_KEY)
    return false
  }

  async function register(
    rawUsername: string,
    password: string,
  ): Promise<AuthResult> {
    const accountName = normalizeUsername(rawUsername)
    const invalid = validateCredentials(accountName, password)
    if (invalid) return invalid

    const accounts = readAccounts()
    if (accounts[accountName])
      return { success: false, message: '该账号已存在，请直接登录' }

    const salt = createSalt()
    accounts[accountName] = {
      username: accountName,
      salt,
      passwordHash: await hashPassword(password, salt),
      createdAt: new Date().toISOString(),
    }
    writeJson(ACCOUNTS_KEY, accounts)
    establishSession(accountName)
    return { success: true, message: '账户创建成功' }
  }

  async function login(
    rawUsername: string,
    password: string,
  ): Promise<AuthResult> {
    const accountName = normalizeUsername(rawUsername)
    if (!accountName || !password)
      return { success: false, message: '请填写账号和密码' }

    const account = readAccounts()[accountName]
    if (!account) return { success: false, message: '账号或密码不正确' }

    const passwordHash = await hashPassword(password, account.salt)
    if (passwordHash !== account.passwordHash) {
      return { success: false, message: '账号或密码不正确' }
    }

    establishSession(account.username)
    return { success: true, message: '登录成功' }
  }

  function logout() {
    username.value = ''
    getStorage()?.removeItem(SESSION_KEY)
  }

  function getRememberedUsername() {
    return getStorage()?.getItem(REMEMBERED_ACCOUNT_KEY) ?? ''
  }

  function rememberUsername(accountName: string | null) {
    const storage = getStorage()
    if (!storage) return
    if (accountName)
      storage.setItem(REMEMBERED_ACCOUNT_KEY, normalizeUsername(accountName))
    else storage.removeItem(REMEMBERED_ACCOUNT_KEY)
  }

  restoreSession()

  return {
    username,
    isAuthenticated,
    getRememberedUsername,
    login,
    logout,
    register,
    rememberUsername,
    restoreSession,
  }
})
