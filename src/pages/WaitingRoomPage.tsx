import { ArrowLeft, Clock3, LoaderCircle, ShieldCheck, Ticket, UsersRound, Zap } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { getEvent, getShowtime, heartbeatQueue, joinQueue, leaveQueue } from '../services/ticketRushApi'
import type { QueueSession, Showtime, TicketRushEvent } from '../types'

export function WaitingRoomPage() {
  const { showtimeId } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const [queue, setQueue] = useState<QueueSession | null>(null)
  const [event, setEvent] = useState<TicketRushEvent | null>(null)
  const [showtime, setShowtime] = useState<Showtime | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  /** When true, unmount must not call leaveQueue — user is moving to seat selection and must keep the active booking-room slot. */
  const skipLeaveOnUnmountRef = useRef(false)

  useEffect(() => {
    skipLeaveOnUnmountRef.current = false
    let cancelled = false
    ;(async () => {
      if (!showtimeId) return
      if (!auth.isAuthenticated) {
        navigate(`/login?next=${encodeURIComponent(`/queue/${showtimeId}`)}`)
        return
      }
      const currentShowtime = await getShowtime(showtimeId)
      if (!currentShowtime) return
      const [currentEvent, session] = await Promise.all([getEvent(currentShowtime.eventId), joinQueue(showtimeId)])
      if (cancelled) return
      if (session.canEnter) {
        skipLeaveOnUnmountRef.current = true
        navigate(`/showtimes/${showtimeId}/seats`, { replace: true })
        return
      }
      setShowtime(currentShowtime)
      setEvent(currentEvent ?? null)
      setQueue(session)
    })()

    return () => {
      cancelled = true
      if (showtimeId && !skipLeaveOnUnmountRef.current) {
        void leaveQueue(showtimeId)
      }
    }
  }, [auth.isAuthenticated, navigate, showtimeId])

  useEffect(() => {
    if (!queue || !showtimeId) return

    const timer = window.setInterval(async () => {
      try {
        const nextQueue = await heartbeatQueue(showtimeId)
        setQueue(nextQueue)
        setWarning(null)
        if (nextQueue.canEnter) {
          skipLeaveOnUnmountRef.current = true
          window.clearInterval(timer)
          window.setTimeout(() => navigate(`/showtimes/${showtimeId}/seats`), 500)
        }
      } catch (error) {
        window.clearInterval(timer)
        const message = error instanceof Error ? error.message : 'Queue session ended.'
        setWarning(message)
        if (message.toLowerCase().includes('removed from queue')) {
          window.setTimeout(() => navigate(showtime ? `/events/${showtime.eventId}` : '/'), 1200)
        }
      }
    }, 5000)

    return () => window.clearInterval(timer)
  }, [navigate, queue, showtime, showtimeId])

  const progress = queue ? Math.max(0, Math.min(100, 100 - (queue.position / Math.max(queue.totalWaiting, 1)) * 100)) : 0
  const estimatedMinutes = queue ? Math.max(1, Math.ceil(queue.position / 25)) : null

  return (
    <section className="waiting-page" aria-labelledby="waiting-title">
      <Link className="secondary-button compact-link" to={event ? `/events/${event.id}` : '/'}>
        <ArrowLeft size={18} strokeWidth={2.5} />
        Back to listing
      </Link>

      <div className="waiting-layout waiting-layout-modern">
        <section className="waiting-card waiting-card-full" aria-live="polite">
          <div className="waiting-header">
            <div className="waiting-copy">
              <p className="eyebrow">
                <UsersRound size={18} strokeWidth={2.5} />
                Virtual Waiting Room
              </p>
              <h1 id="waiting-title">You are in the TicketRush queue.</h1>
              <p className="hero-text">Access is released in batches to protect the seat database during flash sale traffic. Keep this page open.</p>
            </div>
            <span className="form-icon waiting-loader-icon">
              {queue?.canEnter ? <Ticket size={30} strokeWidth={2.5} /> : <LoaderCircle className="spin" size={30} strokeWidth={2.5} />}
            </span>
          </div>

          <div className="waiting-event-summary">
            <p>{event?.name ?? 'Preparing listing'}</p>
            <h2>{queue?.canEnter ? 'Your access is ready' : `Position #${queue?.position ?? '...'}`}</h2>
            <span>{showtime?.venue ?? 'TicketRush venue'}</span>
          </div>

          <div className="waiting-status-strip">
            <span>
              <Clock3 size={16} strokeWidth={2.5} />
              ETA {queue?.canEnter ? 'Now' : `~${estimatedMinutes ?? '...'} min`}
            </span>
            <span>
              <Zap size={16} strokeWidth={2.5} />
              Live updates every 5s
            </span>
          </div>

          <div className="queue-progress-wrap">
            <p>Queue progress</p>
            <div className="queue-progress-percentage">
              <span>{Math.round(progress)}%</span>
              <div className="queue-progress-bar-wrap">
                <div className="queue-progress-bar-fill" style={{ width: `${Math.max(progress, 8)}%` }}>
                  {Math.round(progress)}%
                </div>
              </div>
            </div>
            <div className="queue-progress" aria-label="Queue progress">
              <span style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="waiting-facts waiting-facts-modern">
            <div>
              <strong>{queue?.totalWaiting ?? 0}</strong>
              <span>total waiting</span>
            </div>
            <div>
              <strong>{queue?.canEnter ? 'READY' : 'LIVE'}</strong>
              <span>access state</span>
            </div>
          </div>

          {warning && <div className="auth-note">{warning}</div>}

          <div className="auth-note">
            <ShieldCheck size={18} strokeWidth={2.5} />
            Keep this page open while waiting.
          </div>
        </section>
      </div>
    </section>
  )
}
