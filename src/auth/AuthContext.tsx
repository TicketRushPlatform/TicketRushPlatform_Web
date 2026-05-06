/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearTokens, loadTokens, saveTokens } from '../services/authStorage'
import {
  getMe,
  login,
  register,
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
}

const AuthContext = createContext<AuthContextValue | null>(null)

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
        if (!cancelled) clearTokens()
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
    }),
    [isLoading, signIn, signOut, signUp, tokens, updateProfile, uploadMedia, user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
