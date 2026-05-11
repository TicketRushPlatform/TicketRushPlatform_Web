import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  CircleDollarSign,
  Clock,
  Clapperboard,
  Edit3,
  LoaderCircle,
  MapPin,
  Music2,
  ShieldCheck,
  Ticket,
  UsersRound,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatCurrency, formatDate, getEvent, getSeatsStatus, getShowtimesByEvent } from '../services/ticketRushApi'
import type { Showtime, TicketRushEvent } from '../types'

type ShowtimeSeatStats = {
  available: number
  total: number
  holding: number
  sold: number
}

export function EventDetailPage() {
  const { eventId } = useParams()
  const navigate = useNavigate()
  const auth = useAuth()
  const canEditAll = auth.hasPermission('EVENT_MANAGE_ALL')
  const [event, setEvent] = useState<TicketRushEvent | null>(null)
  const [showtimes, setShowtimes] = useState<Showtime[]>([])
  const [showtimeStats, setShowtimeStats] = useState<Record<string, ShowtimeSeatStats>>({})
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!eventId) return
      setIsLoading(true)
      const [eventDetail, eventShowtimes] = await Promise.all([getEvent(eventId), getShowtimesByEvent(eventId)])
      if (cancelled) return
      setEvent(eventDetail ?? null)
      setShowtimes(eventShowtimes)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [eventId])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!showtimes.length) return
      const pairs = await Promise.all(
        showtimes.map(async (showtime) => {
          try {
            const status = await getSeatsStatus(showtime.id)
            return [showtime.id, { available: status.available, total: status.total, holding: status.holding, sold: status.sold }] as const
          } catch {
            return undefined
          }
        }),
      )
      if (!cancelled) setShowtimeStats(Object.fromEntries(pairs.filter((pair): pair is NonNullable<typeof pair> => Boolean(pair))))
    })()
    return () => {
      cancelled = true
    }
  }, [showtimes])

  if (isLoading) {
    return (
      <section className="state-page">
        <div className="state-block">
          <div className="state-icon">
            <LoaderCircle className="spin" size={34} strokeWidth={2.5} />
          </div>
          <h1>Loading listing</h1>
          <p>TicketRush is preparing showtimes and live seat inventory.</p>
        </div>
      </section>
    )
  }

  if (!event) {
    return (
      <section className="state-page">
        <div className="state-block">
          <h1>Listing not found</h1>
          <p>This event or movie is not available in the mock catalog.</p>
          <Link className="secondary-button" to="/">
            <ArrowLeft size={18} strokeWidth={2.5} />
            Back to Explore
          </Link>
        </div>
      </section>
    )
  }

  const loadedStats = Object.values(showtimeStats)
  const bannerCapacity = loadedStats.length > 0 ? loadedStats.reduce((sum, stats) => sum + stats.total, 0) : event.capacity
  const bannerUnavailable = loadedStats.length > 0 ? loadedStats.reduce((sum, stats) => sum + stats.sold + stats.holding, 0) : event.sold
  const soldPercent = bannerCapacity > 0 ? Math.round((bannerUnavailable / bannerCapacity) * 100) : 0

  function openBooking(showtime: Showtime) {
    const nextPath = showtime.queueEnabled ? `/queue/${showtime.id}` : `/showtimes/${showtime.id}/seats`
    if (!auth.isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(nextPath)}&reason=booking`)
      return
    }
    navigate(nextPath)
  }

  return (
    <section className="event-detail-page" aria-labelledby="event-detail-title">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <Link className="secondary-button compact-link" to="/">
          <ArrowLeft size={18} strokeWidth={2.5} />
          Explore Events
        </Link>
        {canEditAll && event && (
          <Link className="secondary-button compact-link" to={`/admin/events/${event.id}/edit`}>
            <Edit3 size={18} strokeWidth={2.5} />
            Edit Event
          </Link>
        )}
      </div>

      <article className={`event-detail-hero ${!event.imageUrl ? 'no-poster' : ''}`}>
        {event.imageUrl && (
          <div className="event-detail-poster">
            <img src={event.imageUrl} alt="" />
            <span className="status-pill">{event.status}</span>
          </div>
        )}

        <div className="event-detail-info">
          {!event.imageUrl && <span className="status-pill inline">{event.status}</span>}
          <p className="eyebrow">
            {event.kind === 'MOVIE' ? <Clapperboard size={18} strokeWidth={2.5} /> : <Ticket size={18} strokeWidth={2.5} />}
            {event.kind === 'MOVIE' ? 'Movie Ticketing' : event.category}
          </p>
          <h1 id="event-detail-title">{event.name}</h1>
          <p className="hero-text">{event.description}</p>

          <dl className="featured-meta">
            <Meta icon={<CalendarDays size={18} strokeWidth={2.5} />} label="Date" value={formatDate(event.date)} />
            <Meta icon={<Clock size={18} strokeWidth={2.5} />} label="Time" value={event.time} />
            <Meta icon={<MapPin size={18} strokeWidth={2.5} />} label="Venue" value={`${event.venue}, ${event.city}`} />
            <Meta icon={<CircleDollarSign size={18} strokeWidth={2.5} />} label="From" value={formatCurrency(event.priceFrom)} />
          </dl>

          <div className="detail-progress">
            <div>
              <strong>{soldPercent}%</strong>
              <span>sold or held</span>
            </div>
            <div className="capacity-bar" aria-label={`${soldPercent}% sold`}>
              <span style={{ width: `${soldPercent}%` }} />
            </div>
            <p>
              {bannerUnavailable}/{bannerCapacity} seats are currently sold or locked.
            </p>
          </div>
        </div>
      </article>

      {event.kind === 'MOVIE' && event.movie && (
        <section className={`movie-detail-grid ${!event.movie.trailerUrl ? 'no-trailer' : ''}`} aria-label="Movie details">
          {event.movie.trailerUrl && (
            <div className="admin-card trailer-card">
              <div className="trailer-frame">
                <iframe title={`${event.name} trailer`} src={event.movie.trailerUrl} allowFullScreen />
              </div>
            </div>
          )}
          <div className="admin-card movie-meta-card">
            <h2>Movie profile</h2>
            <p>{event.movie.synopsis}</p>
            <dl className="movie-facts">
              <Meta icon={<Clapperboard size={18} />} label="Director" value={event.movie.director} />
              <Meta icon={<Clock size={18} />} label="Runtime" value={`${event.movie.durationMinutes} min`} />
              <Meta icon={<ShieldCheck size={18} />} label="Rating" value={event.movie.ageRating} />
              <Meta icon={<UsersRound size={18} />} label="Cast" value={event.movie.cast.join(', ')} />
            </dl>
            <div className="tag-row">
              {event.movie.genres.map((genre) => (
                <span className="chip" key={genre}>
                  {genre}
                </span>
              ))}
            </div>
          </div>
          {(event.soundtracks && event.soundtracks.length > 0) && (
            <div className="admin-card soundtrack-card">
              <h2>
                <Music2 size={22} />
                Soundtracks
              </h2>
              <div className="soundtrack-list">
                {event.soundtracks.map((track) => (
                  <span key={track.id}>
                    {track.title} · {track.artist}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="admin-card showtime-panel" aria-labelledby="showtime-title">
        <div className="panel-heading">
          <div>
            <h2 id="showtime-title">{event.kind === 'MOVIE' ? 'Cinema showtimes' : 'Available showtimes'}</h2>
            <p>Choose a showtime to enter the waiting room or open the live seat map.</p>
          </div>
          <ShieldCheck size={28} strokeWidth={2.5} />
        </div>

        <div className="showtime-grid">
          {showtimes.map((showtime) => {
            const stats = showtimeStats[showtime.id]
            const fillPercent = stats?.total ? Math.round(((stats.total - stats.available) / stats.total) * 100) : 0
            return (
            <article className="showtime-card themed-showtime-card" key={showtime.id}>
              <div className="showtime-card-head">
                <strong>{formatDate(showtime.startTime.slice(0, 10))}</strong>
                <span>{new Date(showtime.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
              <p className="showtime-meta-line">
                <MapPin size={16} strokeWidth={2.5} />
                {showtime.venue} · {showtime.address}
              </p>
              <div className="showtime-meta-chip-row">
                <span className="showtime-meta-chip">
                  <Ticket size={14} strokeWidth={2.5} />
                  {showtime.seatMapName}
                </span>
                <span className="showtime-meta-chip">
                  <UsersRound size={14} strokeWidth={2.5} />
                  {showtime.queueEnabled ? 'Queue on' : 'Queue off'}
                </span>
              </div>
              <div className="showtime-fill">
                <p>
                  <BarChart3 size={16} strokeWidth={2.5} />
                  {fillPercent}% full
                </p>
                <div className="capacity-bar" aria-label={`${fillPercent}% full`}>
                  <span style={{ width: `${fillPercent}%` }} />
                </div>
              </div>
              <button
                className="primary-button compact-button"
                type="button"
                onClick={() => openBooking(showtime)}
              >
                Book Seats
                <span>
                  <UsersRound size={18} strokeWidth={2.5} />
                </span>
              </button>
            </article>
          )})}
        </div>
      </section>
    </section>
  )
}

function Meta({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div>
      {icon}
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
