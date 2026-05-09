import { config } from '../config/env'

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
  const url = `${config.api.userBaseUrl}${path.startsWith('/') ? path : `/${path}`}`

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
  assigned_roles?: string[]
  permissions?: string[]
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

export type AdminUpdateUserPayload = {
  full_name?: string
  role?: string
  status?: 'ACTIVE' | 'BLOCKED'
}

export type AdminCreateUserPayload = {
  email: string
  password: string
  full_name: string
  role?: string
  status?: 'ACTIVE' | 'BLOCKED'
}

export type RolePermissionSet = {
  name: string
  system: boolean
  permissions: string[]
  created_at: string
  updated_at: string
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

export type UserRoleAssignment = {
  role_name: string
  permissions: string[]
  assigned_at: string
  assigned_by: string | null
}

export type NotificationItem = {
  id: string
  user_id: string
  title: string
  message: string
  tone: 'INFO' | 'SUCCESS' | 'WARNING'
  read: boolean
  link?: string
  created_at: string
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

export async function listUsers(accessToken: string): Promise<User[]> {
  return requestJson<User[]>('/users', { method: 'GET', accessToken })
}

export async function updateUserByAdmin(accessToken: string, userId: string, payload: AdminUpdateUserPayload): Promise<User> {
  return requestJson<User>(`/users/${encodeURIComponent(userId)}`, { method: 'PATCH', accessToken, body: payload })
}

export async function createUserByAdmin(accessToken: string, payload: AdminCreateUserPayload): Promise<User> {
  return requestJson<User>('/users', { method: 'POST', accessToken, body: payload })
}

export async function deleteUserByAdmin(accessToken: string, userId: string): Promise<void> {
  return requestJson<void>(`/users/${encodeURIComponent(userId)}`, { method: 'DELETE', accessToken })
}

export async function listRolePermissions(accessToken: string): Promise<RolePermissionSet[]> {
  return requestJson<RolePermissionSet[]>('/roles', { method: 'GET', accessToken })
}

export async function listPermissionCatalog(accessToken: string): Promise<string[]> {
  const response = await requestJson<{ permissions: string[] }>('/roles/permissions-catalog', { method: 'GET', accessToken })
  return response.permissions
}

export async function createRoleWithPermissions(
  accessToken: string,
  payload: { name: string; permissions: string[] },
): Promise<RolePermissionSet> {
  return requestJson<RolePermissionSet>('/roles', { method: 'POST', accessToken, body: payload })
}

export async function updateRolePermissions(
  accessToken: string,
  roleName: string,
  payload: { permissions_add?: string[]; permissions_remove?: string[]; permissions?: string[] },
): Promise<RolePermissionSet> {
  return requestJson<RolePermissionSet>(`/roles/${encodeURIComponent(roleName)}`, { method: 'PATCH', accessToken, body: payload })
}

export async function deleteRole(accessToken: string, roleName: string): Promise<void> {
  return requestJson<void>(`/roles/${encodeURIComponent(roleName)}`, { method: 'DELETE', accessToken })
}

export async function uploadMyMedia(accessToken: string, payload: UploadMediaPayload): Promise<UploadMediaResponse> {
  const url = `${config.api.userBaseUrl}/users/me/media`
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

export type UserStats = {
  total_users: number
  active_users: number
  blocked_users: number
  admin_count: number
}

export async function getUserStats(accessToken: string): Promise<UserStats> {
  return requestJson<UserStats>('/users/stats', { method: 'GET', accessToken })
}

// ---- Role Assignment APIs ----

export async function listUserRoles(accessToken: string, userId: string): Promise<UserRoleAssignment[]> {
  return requestJson<UserRoleAssignment[]>(`/users/${encodeURIComponent(userId)}/roles`, { method: 'GET', accessToken })
}

export async function assignUserRole(accessToken: string, userId: string, roleName: string): Promise<UserRoleAssignment> {
  return requestJson<UserRoleAssignment>(`/users/${encodeURIComponent(userId)}/roles`, {
    method: 'POST',
    accessToken,
    body: { role_name: roleName },
  })
}

export async function removeUserRole(accessToken: string, userId: string, roleName: string): Promise<void> {
  return requestJson<void>(`/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleName)}`, {
    method: 'DELETE',
    accessToken,
  })
}

// ---- Notification APIs ----

export async function listNotificationsApi(accessToken: string): Promise<NotificationItem[]> {
  return requestJson<NotificationItem[]>('/notifications', { method: 'GET', accessToken })
}

export async function markNotificationReadApi(accessToken: string, notificationId: string): Promise<NotificationItem> {
  return requestJson<NotificationItem>(`/notifications/${encodeURIComponent(notificationId)}/read`, {
    method: 'PATCH',
    accessToken,
  })
}

export async function markAllNotificationsReadApi(accessToken: string): Promise<void> {
  return requestJson<void>('/notifications/read-all', { method: 'PATCH', accessToken })
}

export async function getUnreadNotificationCount(accessToken: string): Promise<number> {
  const response = await requestJson<{ count: number }>('/notifications/unread-count', { method: 'GET', accessToken })
  return response.count
}

export async function deleteNotificationApi(accessToken: string, notificationId: string): Promise<void> {
  return requestJson<void>(`/notifications/${encodeURIComponent(notificationId)}`, {
    method: 'DELETE',
    accessToken,
  })
}

export async function deleteAllNotificationsApi(accessToken: string): Promise<void> {
  return requestJson<void>('/notifications/all', { method: 'DELETE', accessToken })
}
