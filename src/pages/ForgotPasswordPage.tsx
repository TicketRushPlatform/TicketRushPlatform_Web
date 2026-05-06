import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  KeyRound,
  Mail,
  ShieldCheck,
  Sparkles,
  TicketCheck,
} from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSent, setIsSent] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSubmitting(true)
    // Mock: simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1200))
    setIsSent(true)
    setIsSubmitting(false)
  }

  return (
    <section className="forgot-password-page" aria-labelledby="forgot-title">
      <div className="auth-copy">
        <p className="eyebrow">
          <Sparkles size={18} strokeWidth={2.5} />
          TicketRush account
        </p>
        <h1 id="forgot-title">Forgot your password?</h1>
        <p className="hero-text">
          No worries! Enter your email address and we&apos;ll send you a link to reset your password.
        </p>
        <div className="auth-art" aria-hidden="true">
          <div className="auth-ticket">
            <TicketCheck size={38} strokeWidth={2.5} />
            <span>Recovery</span>
          </div>
          <div className="shape-stack">
            <span />
            <span />
            <span />
          </div>
        </div>
      </div>

      <div className="forgot-password-card">
        {isSent ? (
          <div className="forgot-reset-success">
            <span className="form-icon">
              <CheckCircle2 size={32} strokeWidth={2.5} />
            </span>
            <h2>Check your inbox</h2>
            <p className="hero-text">
              We&apos;ve sent a password reset link to <strong>{email}</strong>. Please check your email and follow the instructions.
            </p>
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
                <p>Enter the email associated with your TicketRush account.</p>
              </div>
            </div>

            <label className="field" style={{ marginTop: 18 }}>
              <span>Email address</span>
              <div className="input-shell">
                <Mail size={20} strokeWidth={2.5} aria-hidden="true" />
                <input
                  type="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </label>

            <button className="primary-button" type="submit" disabled={isSubmitting} style={{ marginTop: 14 }}>
              {isSubmitting ? 'Sending...' : 'Send reset link'}
              <span>
                <ArrowRight size={18} strokeWidth={2.5} />
              </span>
            </button>

            <Link className="secondary-button compact-button" to="/login" style={{ marginTop: 8, justifyContent: 'center', width: '100%' }}>
              <ArrowLeft size={18} strokeWidth={2.5} />
              Back to Sign in
            </Link>

            <div className="auth-note">
              <ShieldCheck size={18} strokeWidth={2.5} />
              Your account security is our priority.
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
