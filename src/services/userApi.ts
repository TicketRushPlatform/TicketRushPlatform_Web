export type ApiErrorResponse = {
  code: string
  message: string
  details: Record<string, unknown>
}

export class ApiError extends Error {
  status: number
  body?: ApiErrorResponse

  constructor(status: number, message: string, body?: ApiErrorResponse) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.body = body
  }
}

const DEFAULT_BASE_URL = '/user-api'

function getBaseUrl(): string {
  const fromEnv = (import.meta as any).env?.VITE_USER_API_URL as string | undefined
  return fromEnv?.trim() ? fromEnv.trim().replace(/\/$/, '') : DEFAULT_BASE_URL
}

async function parseJsonSafe(response: Response): Promise<unknown | undefined> {
  const text = await response.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

async function requestJson<T>(
  path: string,
  options: {
    method: string
    body?: unknown
    accessToken?: string
  },
): Promise<T> {
  const url = `${getBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`

  const headers: Record<string, string> = {
    accept: 'application/json',
  }

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json'
  }

  if (options.accessToken) {
    headers.authorization = `Bearer ${options.accessToken}`
  }

  const response = await fetch(url, {
    method: options.method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })

  if (response.status === 204) {
    return undefined as T
  }

  const data = await parseJsonSafe(response)

  if (!response.ok) {
    const maybeBody = (data && typeof data === 'object' ? (data as ApiErrorResponse) : undefined)
    const message = maybeBody?.message ?? response.statusText ?? 'Request failed'
    throw new ApiError(response.status, message, maybeBody)
  }

  return data as T
}

export type TokenPair = {
  access_token: string
  refresh_token: string
  token_type: string
}

export type User = {
  id: string
  email: string | null
  full_name: string
  avatar_url: string | null
  gender: 'male' | 'female' | 'other' | null
  age: number | null
  address: string | null
  phone_number: string | null
  bio: string | null
  provider: string
  role: string
  status: string
  created_at: string
  updated_at: string
}

export type RegisterPayload = {
  email: string
  password: string
  full_name: string
}

export type LoginPayload = {
  email: string
  password: string
}

export type RefreshPayload = {
  refresh_token: string
}

export type UpdateMePayload = {
  full_name?: string
  avatar_url?: string | null
  gender?: 'male' | 'female' | 'other' | null
  age?: number | null
  address?: string | null
  phone_number?: string | null
  bio?: string | null
}

export type OAuthPayload = {
  id_token?: string
  access_token?: string
  authorization_code?: string
  redirect_uri?: string
}

export type UploadMediaPayload = {
  file: File
  kind?: 'avatar' | 'video'
}

export type UploadMediaResponse = {
  url: string
}

export async function register(payload: RegisterPayload): Promise<TokenPair> {
  return requestJson<TokenPair>('/auth/register', { method: 'POST', body: payload })
}

export async function login(payload: LoginPayload): Promise<TokenPair> {
  return requestJson<TokenPair>('/auth/login', { method: 'POST', body: payload })
}

export async function refresh(payload: RefreshPayload): Promise<TokenPair> {
  return requestJson<TokenPair>('/auth/refresh', { method: 'POST', body: payload })
}

export async function logout(payload: RefreshPayload): Promise<void> {
  return requestJson<void>('/auth/logout', { method: 'POST', body: payload })
}

export async function oauthGoogle(payload: OAuthPayload): Promise<TokenPair> {
  return requestJson<TokenPair>('/auth/oauth/google', { method: 'POST', body: payload })
}

export async function oauthFacebook(payload: OAuthPayload): Promise<TokenPair> {
  return requestJson<TokenPair>('/auth/oauth/facebook', { method: 'POST', body: payload })
}

export async function getMe(accessToken: string): Promise<User> {
  return requestJson<User>('/users/me', { method: 'GET', accessToken })
}

export async function updateMe(accessToken: string, payload: UpdateMePayload): Promise<User> {
  return requestJson<User>('/users/me', { method: 'PATCH', accessToken, body: payload })
}

export async function getUser(accessToken: string, userId: string): Promise<User> {
  return requestJson<User>(`/users/${encodeURIComponent(userId)}`, { method: 'GET', accessToken })
}

export async function uploadMyMedia(accessToken: string, payload: UploadMediaPayload): Promise<UploadMediaResponse> {
  const url = `${getBaseUrl()}/users/me/media`
  const formData = new FormData()
  formData.set('kind', payload.kind ?? 'avatar')
  formData.set('file', payload.file)

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${accessToken}`,
      accept: 'application/json',
    },
    body: formData,
  })

  const data = await parseJsonSafe(response)
  if (!response.ok) {
    const maybeBody = (data && typeof data === 'object' ? (data as ApiErrorResponse) : undefined)
    const message = maybeBody?.message ?? response.statusText ?? 'Upload failed'
    throw new ApiError(response.status, message, maybeBody)
  }

  return data as UploadMediaResponse
}
