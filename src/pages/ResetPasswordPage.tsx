import { ArrowLeft, ArrowRight, CheckCircle2, KeyRound, LockKeyhole, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { resetPassword } from '../services/userApi'

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDone, setIsDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setIsSubmitting(true)
    try {
      await resetPassword({ token, password })
      setIsDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset password.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="forgot-password-page" aria-labelledby="reset-title">
      <div className="auth-copy">
        <p className="eyebrow">
          <Sparkles size={18} strokeWidth={2.5} />
          TicketRush account
        </p>
        <h1 id="reset-title">Create a new password.</h1>
        <p className="hero-text">Use a strong password to protect your checkout and ticket history.</p>
      </div>

      <div className="forgot-password-card">
        {isDone ? (
          <div className="forgot-reset-success">
            <span className="form-icon">
              <CheckCircle2 size={32} strokeWidth={2.5} />
            </span>
            <h2>Password updated</h2>
            <p className="hero-text">You can now sign in with your new password.</p>
            <Link className="primary-button compact-button" to="/login">
              Back to Sign in
              <span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
            </Link>
          </div>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="form-heading">
              <span className="form-icon pink">
                <KeyRound size={24} strokeWidth={2.5} />
              </span>
              <div>
                <h2>Reset password</h2>
                <p>Enter your new TicketRush password.</p>
              </div>
            </div>

            {!token && <p className="form-error">Reset token is missing. Please request a new reset link.</p>}

            <label className="field" style={{ marginTop: 18 }}>
              <span>New password</span>
              <div className="input-shell">
                <LockKeyhole size={20} strokeWidth={2.5} aria-hidden="true" />
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </div>
            </label>

            <label className="field" style={{ marginTop: 12 }}>
              <span>Confirm password</span>
              <div className="input-shell">
                <LockKeyhole size={20} strokeWidth={2.5} aria-hidden="true" />
                <input
                  type="password"
                  placeholder="Repeat new password"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                />
              </div>
            </label>

            <button className="primary-button" type="submit" disabled={isSubmitting || !token} style={{ marginTop: 14 }}>
              {isSubmitting ? 'Updating...' : 'Update password'}
              <span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
            </button>

            {error && <p className="form-error">{error}</p>}

            <Link className="secondary-button compact-button" to="/login" style={{ marginTop: 8, justifyContent: 'center', width: '100%' }}>
              <ArrowLeft size={18} strokeWidth={2.5} />
              Back to Sign in
            </Link>
          </form>
        )}
      </div>
    </section>
  )
}
