/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearTokens, loadTokens, saveTokens } from '../services/authStorage'
import {
  getMe,
  login,
  register,
  refresh,
  uploadMyMedia,
  updateMe,
  type LoginPayload,
  type RegisterPayload,
  type TokenPair,
  type UploadMediaPayload,
  type UpdateMePayload,
  type User,
} from '../services/userApi'

type AuthContextValue = {
  user: User | null
  tokens: TokenPair | null
  isLoading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
  signIn: (payload: LoginPayload, remember?: boolean) => Promise<User>
  signUp: (payload: RegisterPayload, remember?: boolean) => Promise<User>
  updateProfile: (payload: UpdateMePayload) => Promise<User>
  uploadMedia: (payload: UploadMediaPayload) => Promise<string>
  signOut: () => void
  hasPermission: (permission: string) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Try refreshing the access token using the stored refresh token. */
async function tryRefreshTokens(stored: TokenPair): Promise<TokenPair | null> {
  try {
    const newTokens = await refresh({ refresh_token: stored.refresh_token })
    saveTokens(newTokens, { persist: true })
    return newTokens
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [tokens, setTokens] = useState<TokenPair | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const hydrateUser = useCallback(async (nextTokens: TokenPair) => {
    const nextUser = await getMe(nextTokens.access_token)
    setTokens(nextTokens)
    setUser(nextUser)
    return nextUser
  }, [])

  // Auto-refresh: set up a timer to refresh the access token before it expires
  useEffect(() => {
    if (!tokens) return

    // Refresh 60 seconds before the access token expires (TTL is ~900s)
    const refreshInterval = window.setInterval(async () => {
      const stored = loadTokens()
      if (!stored) return
      const refreshed = await tryRefreshTokens(stored)
      if (refreshed) {
        setTokens(refreshed)
        try {
          const nextUser = await getMe(refreshed.access_token)
          setUser(nextUser)
        } catch {
          // User data fetch failed but token is still valid
        }
      }
    }, 13 * 60 * 1000) // Refresh every 13 minutes (before 15-min TTL)

    return () => window.clearInterval(refreshInterval)
  }, [tokens])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const stored = loadTokens()
      if (!stored) {
        setIsLoading(false)
        return
      }

      try {
        const nextUser = await getMe(stored.access_token)
        if (cancelled) return
        setTokens(stored)
        setUser(nextUser)
      } catch {
        // Access token likely expired - try refresh
        if (cancelled) return
        const refreshed = await tryRefreshTokens(stored)
        if (cancelled) return
        if (refreshed) {
          try {
            const nextUser = await getMe(refreshed.access_token)
            if (cancelled) return
            setTokens(refreshed)
            setUser(nextUser)
          } catch {
            if (!cancelled) clearTokens()
          }
        } else {
          if (!cancelled) clearTokens()
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  const signIn = useCallback(
    async (payload: LoginPayload, remember = true) => {
      const nextTokens = await login(payload)
      saveTokens(nextTokens, { persist: remember })
      return hydrateUser(nextTokens)
    },
    [hydrateUser],
  )

  const signUp = useCallback(
    async (payload: RegisterPayload, remember = true) => {
      const nextTokens = await register(payload)
      saveTokens(nextTokens, { persist: remember })
      return hydrateUser(nextTokens)
    },
    [hydrateUser],
  )

  const updateProfile = useCallback(
    async (payload: UpdateMePayload) => {
      if (!tokens) throw new Error('You must be signed in to update your profile.')
      const nextUser = await updateMe(tokens.access_token, payload)
      setUser(nextUser)
      return nextUser
    },
    [tokens],
  )

  const signOut = useCallback(() => {
    clearTokens()
    setTokens(null)
    setUser(null)
  }, [])

  const uploadMedia = useCallback(
    async (payload: UploadMediaPayload) => {
      if (!tokens) throw new Error('You must be signed in to upload media.')
      const uploaded = await uploadMyMedia(tokens.access_token, payload)
      return uploaded.url
    },
    [tokens],
  )

  const hasPermission = useCallback(
    (permission: string) => {
      if (!user) return false
      if ((user.role ?? '').toLowerCase() === 'admin') return true
      return (user.permissions ?? []).includes(permission)
    },
    [user],
  )

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      tokens,
      isLoading,
      isAuthenticated: Boolean(user),
      isAdmin: (user?.role ?? '').toLowerCase() === 'admin',
      signIn,
      signUp,
      updateProfile,
      uploadMedia,
      signOut,
      hasPermission,
    }),
    [isLoading, signIn, signOut, signUp, tokens, updateProfile, uploadMedia, user, hasPermission],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}

