const DEFAULT_USER_API_BASE_URL = '/user-api'
const DEFAULT_EVENT_API_BASE_URL = '/event-api/api/v1'

function getRuntimeConfig(): AppRuntimeConfig | undefined {
  if (typeof window === 'undefined') return undefined
  const globalAny = window as any
  return globalAny.__APP_CONFIG__ as AppRuntimeConfig | undefined
}

const runtimeConfig = getRuntimeConfig()
const viteEnv = import.meta.env

function normalizeBaseUrl(value?: string): string | undefined {
  if (!value) return undefined
  const trimmed = value.trim()
  if (!trimmed) return undefined
  return trimmed.replace(/\/$/, '')
}

function pickString(...candidates: Array<string | undefined>): string | undefined {
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }
  return undefined
}

function requireInProd(name: string, value: string | undefined): string | undefined {
  if (viteEnv.MODE === 'production' && !value) {
    // Centralized warning for missing required configuration in production
    // Consumers can still handle undefined gracefully in UI.
    // eslint-disable-next-line no-console
    console.error(`[Config] Missing required config value: ${name}`)
  }
  return value
}

const userApiBaseUrl =
  normalizeBaseUrl(
    pickString(runtimeConfig?.api?.userBaseUrl, viteEnv.VITE_USER_API_URL) ?? DEFAULT_USER_API_BASE_URL,
  ) ?? DEFAULT_USER_API_BASE_URL

const eventApiBaseUrl =
  normalizeBaseUrl(
    pickString(runtimeConfig?.api?.eventBaseUrl, viteEnv.VITE_EVENT_API_URL) ?? DEFAULT_EVENT_API_BASE_URL,
  ) ?? DEFAULT_EVENT_API_BASE_URL

const googleClientId = requireInProd(
  'oauth.googleClientId',
  pickString(runtimeConfig?.oauth?.googleClientId, viteEnv.VITE_GOOGLE_CLIENT_ID),
)

const facebookAppId = requireInProd(
  'oauth.facebookAppId',
  pickString(runtimeConfig?.oauth?.facebookAppId, viteEnv.VITE_FACEBOOK_APP_ID),
)

const redirectBase =
  normalizeBaseUrl(
    pickString(
      runtimeConfig?.oauth?.redirectBase,
      viteEnv.VITE_OAUTH_REDIRECT_BASE_URL,
      typeof window !== 'undefined' ? window.location.origin : undefined,
    ),
  ) ?? (typeof window !== 'undefined' ? window.location.origin : '')

export const config = {
  api: {
    userBaseUrl: userApiBaseUrl,
    eventBaseUrl: eventApiBaseUrl,
  },
  oauth: {
    googleClientId,
    facebookAppId,
    redirectBase,
  },
} as const

