import type { TokenPair } from './userApi'

const STORAGE_KEY = 'ticketrush.tokens'
export const AUTH_CHANGE_EVENT = 'ticketrush-auth-change'

type SaveOptions = {
  persist?: boolean
}

function read(storage: Storage): TokenPair | null {
  const raw = storage.getItem(STORAGE_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as TokenPair
  } catch {
    return null
  }
}

export function loadTokens(): TokenPair | null {
  return read(localStorage) ?? read(sessionStorage)
}

export function getTokenPersistence(): boolean | null {
  if (localStorage.getItem(STORAGE_KEY)) return true
  if (sessionStorage.getItem(STORAGE_KEY)) return false
  return null
}

export function saveTokens(tokens: TokenPair, options: SaveOptions = {}): void {
  const persist = options.persist ?? true
  const storage = persist ? localStorage : sessionStorage
  const alternateStorage = persist ? sessionStorage : localStorage
  alternateStorage.removeItem(STORAGE_KEY)
  storage.setItem(STORAGE_KEY, JSON.stringify(tokens))
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT))
}

export function clearTokens(): void {
  localStorage.removeItem(STORAGE_KEY)
  sessionStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new CustomEvent(AUTH_CHANGE_EVENT))
}
