export {}

declare global {
  interface AppRuntimeConfig {
    api?: {
      userBaseUrl?: string
      eventBaseUrl?: string
    }
    oauth?: {
      googleClientId?: string
      facebookAppId?: string
      redirectBase?: string
    }
  }

  interface Window {
    __APP_CONFIG__?: AppRuntimeConfig
  }
}

