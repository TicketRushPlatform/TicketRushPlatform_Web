import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
  TicketCheck,
  UserRound
} from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ApiError, oauthFacebook, oauthGoogle } from '../services/userApi'
import { saveTokens } from '../services/authStorage'
import { config } from '../config/env'

type AuthMode = 'login' | 'register'

type NoticeTone = 'success' | 'error' | 'info'
type Notice = {
  tone: NoticeTone
  message: string
}
type OAuthProvider = 'google' | 'facebook'

export function AuthPage({ initialMode = 'login' }: { initialMode?: AuthMode }) {
  const auth = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<AuthMode>(initialMode)
  const isLogin = mode === 'login'
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isOAuthProcessing, setIsOAuthProcessing] = useState(false)

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) navigate('/profile', { replace: true })
  }, [auth.isAuthenticated, auth.isLoading, navigate])

  useEffect(() => {
    const provider = getOAuthProviderFromPath(location.pathname)
    if (!provider) return

    let cancelled = false
    const params = new URLSearchParams(location.search)
    const authorizationCode = params.get('code')
    const returnedState = params.get('state')
    const oauthError = params.get('error')
    const expectedState = sessionStorage.getItem(getOAuthStateStorageKey(provider))

    ;(async () => {
      setIsOAuthProcessing(true)
      setNotice(null)
      if (oauthError) {
        if (cancelled) return
        setNotice({ tone: 'error', message: `OAuth failed: ${oauthError}` })
        navigate('/login', { replace: true })
        setIsOAuthProcessing(false)
        return
      }
      if (!authorizationCode || !returnedState) {
        if (cancelled) return
        setNotice({ tone: 'error', message: 'OAuth callback state is invalid. Please try again.' })
        navigate('/login', { replace: true })
        setIsOAuthProcessing(false)
        return
      }

      if (expectedState && returnedState !== expectedState) {
        if (cancelled) return
        setNotice({ tone: 'error', message: 'OAuth callback state is invalid. Please try again.' })
        navigate('/login', { replace: true })
        setIsOAuthProcessing(false)
        return
      }

      if (expectedState) {
        sessionStorage.removeItem(getOAuthStateStorageKey(provider))
      }

      try {
        const redirectUri = getOAuthRedirectUri(provider)
        const pair =
          provider === 'google'
            ? await oauthGoogle({ authorization_code: authorizationCode, redirect_uri: redirectUri })
            : await oauthFacebook({ authorization_code: authorizationCode, redirect_uri: redirectUri })

        saveTokens(pair, { persist: true })
        if (cancelled) return
        window.location.assign('/')
      } catch (error) {
        if (cancelled) return
        if (error instanceof ApiError) {
          setNotice({ tone: 'error', message: error.body?.message ?? error.message })
        } else {
          setNotice({ tone: 'error', message: 'OAuth sign-in failed. Please try again.' })
        }
        navigate('/login', { replace: true })
      } finally {
        if (!cancelled) {
          setIsOAuthProcessing(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [location.pathname, location.search, navigate])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    setNotice(null)

    try {
      if (isLogin) {
        await auth.signIn({ email, password }, rememberMe)
      } else {
        await auth.signUp({ email, password, full_name: fullName }, rememberMe)
      }
      navigate('/', { replace: true })
    } catch (error) {
      if (error instanceof ApiError) {
        setNotice({ tone: 'error', message: error.body?.message ?? error.message })
      } else {
        setNotice({ tone: 'error', message: 'Something went wrong. Please try again.' })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  function startOAuth(provider: OAuthProvider) {
    const clientId = provider === 'google' ? config.oauth.googleClientId : config.oauth.facebookAppId

    if (!clientId?.trim()) {
      setNotice({
        tone: 'error',
        message:
          provider === 'google'
            ? 'Missing VITE_GOOGLE_CLIENT_ID in frontend environment.'
            : 'Missing VITE_FACEBOOK_APP_ID in frontend environment.',
      })
      return
    }

    const redirectUri = getOAuthRedirectUri(provider)
    const state = generateClientState()
    sessionStorage.setItem(getOAuthStateStorageKey(provider), state)

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        state,
        prompt: 'select_account',
      })
      window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
      return
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'email,public_profile',
      state,
    })
    window.location.assign(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`)
  }

  return (
    <section className="auth-page" aria-labelledby="auth-title">
      <div className="auth-copy">
        <>
          <p className="eyebrow">
            <Sparkles size={18} strokeWidth={2.5} />
            TicketRush account
          </p>
          <h1 id="auth-title">{isLogin ? 'Jump back into the rush.' : 'Create your event passport.'}</h1>
          <p className="hero-text">
            {isLogin
              ? 'Sign in to manage tickets, track favorite events, and keep checkout details ready.'
              : 'Save events, move faster at checkout, and get alerts when high-demand tickets start moving.'}
          </p>
          <div className="auth-art" aria-hidden="true">
            <div className="auth-ticket">
              <TicketCheck size={38} strokeWidth={2.5} />
              <span>{isLogin ? 'Fast lane' : 'New pass'}</span>
            </div>
            <div className="shape-stack">
              <span />
              <span />
              <span />
            </div>
          </div>
        </>
      </div>

      <form className="auth-card" onSubmit={onSubmit}>
        {notice && (
          <div className={`auth-notice ${notice.tone}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
            <span className="auth-notice-icon" aria-hidden="true">
              {notice.tone === 'success' ? (
                <CheckCircle2 size={18} strokeWidth={2.5} />
              ) : notice.tone === 'error' ? (
                <AlertCircle size={18} strokeWidth={2.5} />
              ) : (
                <ShieldCheck size={18} strokeWidth={2.5} />
              )}
            </span>
            <p>{notice.message}</p>
          </div>
        )}

        {auth.isLoading || isOAuthProcessing ? (
          <div className="auth-loading" aria-live="polite">
            {isOAuthProcessing ? 'Completing OAuth sign-in…' : 'Checking session…'}
          </div>
        ) : (
          <>
        <div className="auth-tabs" role="tablist" aria-label="Account mode">
          <button
            className={isLogin ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={isLogin}
            onClick={() => {
              setMode('login')
              setNotice(null)
            }}
          >
            Login
          </button>
          <button
            className={!isLogin ? 'active' : ''}
            type="button"
            role="tab"
            aria-selected={!isLogin}
            onClick={() => {
              setMode('register')
              setNotice(null)
            }}
          >
            Register
          </button>
        </div>

        <div className="form-heading">
          <span className={isLogin ? 'form-icon' : 'form-icon pink'}>
            {isLogin ? (
              <LockKeyhole size={24} strokeWidth={2.5} />
            ) : (
              <UserRound size={24} strokeWidth={2.5} />
            )}
          </span>
          <div>
            <h2>{isLogin ? 'Login' : 'Register'}</h2>
            <p>{isLogin ? 'Use your TicketRush account.' : 'Backend signup can connect here later.'}</p>
          </div>
        </div>

        <div className="social-login-grid">
          <button
            className="social-button google"
            type="button"
            onClick={() => startOAuth('google')}
            disabled={isSubmitting}
          >
            <span>G</span>
            Google
          </button>
          <button
            className="social-button facebook"
            type="button"
            onClick={() => startOAuth('facebook')}
            disabled={isSubmitting}
          >
            <span>f</span>
            Facebook
          </button>
        </div>

        <div className="form-divider">
          <span>or continue with email</span>
        </div>

        {!isLogin && (
          <label className="field">
            <span>Full name</span>
            <div className="input-shell">
              <UserRound size={20} strokeWidth={2.5} aria-hidden="true" />
              <input
                type="text"
                placeholder="Alex Morgan"
                autoComplete="name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
              />
            </div>
          </label>
        )}

        <label className="field">
          <span>Email</span>
          <div className="input-shell">
            <Mail size={20} strokeWidth={2.5} aria-hidden="true" />
            <input
              type="email"
              placeholder="you@example.com"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        </label>

        <label className="field">
          <span>Password</span>
          <div className="input-shell">
            <LockKeyhole size={20} strokeWidth={2.5} aria-hidden="true" />
            <input
              type="password"
              placeholder={isLogin ? 'Enter password' : 'At least 8 characters'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
        </label>

        {isLogin ? (
          <div className="form-row">
            <label className="check-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>Remember me</span>
            </label>
            <Link to="/forgot-password">Forgot password?</Link>
          </div>
        ) : (
          <label className="check-row terms-row">
            <input type="checkbox" required />
            <span>I agree to TicketRush updates and account terms.</span>
          </label>
        )}

        <button className="primary-button" type="submit" disabled={isSubmitting}>
          {isLogin ? 'Sign in' : 'Create account'}
          <span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </span>
        </button>

        <div className="auth-note">
          <ShieldCheck size={18} strokeWidth={2.5} />
          Sign in to view your TicketRush profile.
        </div>
          </>
        )}
      </form>
    </section>
  )
}

function getOAuthProviderFromPath(pathname: string): OAuthProvider | null {
  if (pathname === '/auth/callback/google') return 'google'
  if (pathname === '/auth/callback/facebook') return 'facebook'
  return null
}

function getOAuthStateStorageKey(provider: OAuthProvider) {
  return `ticketrush.oauth.state.${provider}`
}

function getOAuthRedirectUri(provider: OAuthProvider) {
  const base = config.oauth.redirectBase || window.location.origin
  return `${base}/auth/callback/${provider}`
}

function generateClientState() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `state-${Date.now()}-${Math.random().toString(16).slice(2)}`
}
