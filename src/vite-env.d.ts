/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USER_API_URL?: string
  readonly VITE_EVENT_API_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_FACEBOOK_APP_ID?: string
  readonly VITE_OAUTH_REDIRECT_BASE_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
