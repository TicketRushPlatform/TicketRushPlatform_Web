import { AlertCircle, ArrowLeft, CalendarDays, CheckCircle2, Clock, LoaderCircle, MapPin, RotateCcw, Ticket } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  formatCurrency,
  formatDate,
  getEvent,
  getQueueStatus,
  getSeatsStatus,
  getShowtime,
  heartbeatQueue,
  holdSeats,
  leaveQueue,
  subscribeSeatsStatus,
} from '../services/ticketRushApi'
import type { Seat, SeatClass, Showtime, TicketRushEvent } from '../types'

type RowGroup = {
  row: string
  seats: Seat[]
}

export function SeatSelectionPage() {
  const { showtimeId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const auth = useAuth()
  const [event, setEvent] = useState<TicketRushEvent | null>(null)
  const [showtime, setShowtime] = useState<Showtime | null>(null)
  const [seats, setSeats] = useState<Seat[]>([])
  const [selectedSeatIds, setSelectedSeatIds] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isHolding, setIsHolding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  /** User holds an active Redis "booking room" slot (queue enabled + passed gate); leaving the page must release it. */
  const [bookingRoomActive, setBookingRoomActive] = useState(false)
  /** Avoid releasing the slot on React Strict Mode dev remount before the first real paint cycle. */
  const allowSessionEndRef = useRef(false)
  const seatsRef = useRef<Seat[]>([])

  useEffect(() => {
    const t = window.setTimeout(() => {
      allowSessionEndRef.current = true
    }, 0)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    seatsRef.current = seats
  }, [seats])

  async function loadSeats(silent = false) {
    if (!showtimeId) return
    if (!silent) setIsLoading(true)
    const status = await getSeatsStatus(showtimeId)
    setSeats(status.seats)
    setSelectedSeatIds((current) => current.filter((seatId) => status.seats.some((seat) => seat.id === seatId && seat.status === 'AVAILABLE')))
    if (!silent) setIsLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    setBookingRoomActive(false)
    ;(async () => {
      if (!showtimeId) return
      const currentShowtime = await getShowtime(showtimeId)
      if (!currentShowtime || cancelled) return

      if (currentShowtime.queueEnabled) {
        if (!auth.isAuthenticated) {
          setIsLoading(false)
          navigate(`/login?next=${encodeURIComponent(`/showtimes/${showtimeId}/seats`)}`, { replace: true })
          return
        }
        try {
          const q = await getQueueStatus(showtimeId)
          if (cancelled) return
          if (!q.canEnter) {
            setIsLoading(false)
            navigate(`/queue/${showtimeId}`, { replace: true })
            return
          }
          setBookingRoomActive(true)
        } catch {
          if (!cancelled) {
            setIsLoading(false)
            navigate(`/queue/${showtimeId}`, { replace: true })
          }
          return
        }
      } else {
        setBookingRoomActive(false)
      }

      const currentEvent = await getEvent(currentShowtime.eventId)
      if (cancelled) return
      setShowtime(currentShowtime)
      setEvent(currentEvent ?? null)
      await loadSeats()
    })()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtimeId, auth.isAuthenticated, navigate])

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search)
    if (searchParams.get('holdExpired') !== '1') return

    setNotice('Seat hold expired because payment time exceeded 10 minutes. Please select seats again.')
    searchParams.delete('holdExpired')
    const nextSearch = searchParams.toString()
    navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }, [location.pathname, location.search, navigate])

  useEffect(() => {
    if (!showtimeId || !bookingRoomActive) return

    const tick = () => {
      void heartbeatQueue(showtimeId).catch((err) => {
        const message = err instanceof Error ? err.message : 'Booking room session ended.'
        setError(message)
        navigate(`/queue/${showtimeId}`, { replace: true })
      })
    }

    tick()
    const timer = window.setInterval(tick, 8000)
    return () => window.clearInterval(timer)
  }, [showtimeId, bookingRoomActive, navigate])

  useEffect(() => {
    if (!showtimeId || !bookingRoomActive) return

    const onPageHide = () => {
      if (allowSessionEndRef.current) void leaveQueue(showtimeId)
    }
    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [showtimeId, bookingRoomActive])

  useEffect(() => {
    return () => {
      if (showtimeId && bookingRoomActive && allowSessionEndRef.current) {
        void leaveQueue(showtimeId)
      }
    }
  }, [showtimeId, bookingRoomActive])

  useEffect(() => {
    if (!showtimeId) return

    const unsubscribe = subscribeSeatsStatus(
      showtimeId,
      (status) => {
        const nextSeats = seatsRef.current.map((seat) => {
          const realtimeSeat = status.seats.find((item) => item.id === seat.id || (item.row === seat.row && item.number === seat.number))
          if (!realtimeSeat) return seat
          return {
            ...seat,
            status: realtimeSeat.status,
            seatClass: realtimeSeat.seatClass,
            price: realtimeSeat.price ?? seat.price,
            expiresAt: realtimeSeat.expiresAt,
          }
        })
        seatsRef.current = nextSeats
        setSeats(nextSeats)
        const unavailableSeatIds = new Set(nextSeats.filter((seat) => seat.status !== 'AVAILABLE').map((seat) => seat.id))
        setSelectedSeatIds((current) => current.filter((seatId) => !unavailableSeatIds.has(seatId)))
      },
      () => {
        void loadSeats(true)
      },
    )

    const timer = window.setInterval(() => {
      void loadSeats(true)
    }, 10000)

    return () => {
      unsubscribe()
      window.clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showtimeId])

  const rowGroups = useMemo<RowGroup[]>(() => {
    const grouped = seats.reduce<Record<string, Seat[]>>((acc, seat) => {
      acc[seat.row] = [...(acc[seat.row] ?? []), seat]
      return acc
    }, {})

    return Object.entries(grouped)
      .sort(([first], [second]) => first.localeCompare(second))
      .map(([row, rowSeats]) => ({ row, seats: rowSeats.sort((first, second) => first.number - second.number) }))
  }, [seats])

  const selectedSeats = seats.filter((seat) => selectedSeatIds.includes(seat.id))
  const totalAmount = selectedSeats.reduce((sum, seat) => sum + seat.price, 0)
  const counts = {
    available: seats.filter((seat) => seat.status === 'AVAILABLE').length,
    holding: seats.filter((seat) => seat.status === 'HOLDING').length,
    sold: seats.filter((seat) => seat.status === 'SOLD').length,
  }

  function toggleSeat(seat: Seat) {
    if (seat.status !== 'AVAILABLE') return
    setError(null)
    setSelectedSeatIds((current) => (current.includes(seat.id) ? current.filter((seatId) => seatId !== seat.id) : [...current, seat.id]))
  }

  async function onHoldSeats() {
    if (!showtimeId || selectedSeatIds.length === 0) return
    if (!auth.isAuthenticated) {
      navigate(`/login?next=${encodeURIComponent(`/showtimes/${showtimeId}/seats`)}`)
      return
    }
    setIsHolding(true)
    setError(null)

    try {
      const booking = await holdSeats(showtimeId, selectedSeatIds, auth.user?.id)
      navigate(`/checkout/${booking.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not hold these seats. Please try again.')
      await loadSeats(true)
    } finally {
      setIsHolding(false)
    }
  }

  if (isLoading) {
    return (
      <section className="state-page">
        <div className="state-block">
          <div className="state-icon">
            <LoaderCircle className="spin" size={34} strokeWidth={2.5} />
          </div>
          <h1>Loading seat map</h1>
          <p>Seat status updates automatically in realtime.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="seat-selection-page" aria-labelledby="seat-title">
      <div className="seat-header">
        <Link className="secondary-button compact-link" to={event ? `/events/${event.id}` : '/'}>
          <ArrowLeft size={18} strokeWidth={2.5} />
          Back
        </Link>
        <button className="secondary-button compact-link" type="button" onClick={() => loadSeats(true)}>
          <RotateCcw size={18} strokeWidth={2.5} />
          Refresh seats
        </button>
      </div>

      <div className="seat-layout">
        <section className="seat-map-area">
          <div className="seat-title-block">
            <p className="eyebrow">
              <Ticket size={18} strokeWidth={2.5} />
              Select Seats
            </p>
            <h1 id="seat-title">{event?.name ?? 'Seat map'}</h1>
            <p>{showtime?.venue}</p>
          </div>

          <div className="stage seat-stage">{event?.kind === 'MOVIE' ? 'Screen' : 'Stage'}</div>

          <div className="seat-grid-wrap" aria-label="Seat selection map">
            {rowGroups.map((group) => (
              <div className="seat-row" key={group.row}>
                <span className="seat-row-label">{group.row}</span>
                <div className="seat-row-cells">
                  {group.seats.map((seat) => {
                    const isSelected = selectedSeatIds.includes(seat.id)
                    return (
                      <button
                        className={`seat-cell ${seatClassTone(seat.seatClass)} ${seat.status.toLowerCase()} ${isSelected ? 'selected' : ''}`}
                        key={seat.id}
                        type="button"
                        disabled={seat.status !== 'AVAILABLE'}
                        onClick={() => toggleSeat(seat)}
                        title={`${seat.section} ${seat.row}${seat.number} - ${formatCurrency(seat.price)}`}
                        aria-label={`Seat ${seat.row}${seat.number}, ${seat.status}`}
                      >
                        {seat.number}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="seat-legend">
            <Legend className="standard" label="Standard" />
            <Legend className="vip" label="VIP" />
            <Legend className="premium" label="Premium" />
            <Legend className="deluxe" label="Deluxe" />
            <Legend className="selected" label="Selected" />
            <Legend className="holding" label="Held" />
            <Legend className="sold" label="Sold" />
          </div>
        </section>

        <aside className="admin-card seat-summary">
          <h2>Seat hold</h2>
          <dl className="ticket-facts">
            <Meta icon={<CalendarDays size={18} strokeWidth={2.5} />} label="Date" value={event ? formatDate(event.date) : '-'} />
            <Meta icon={<Clock size={18} strokeWidth={2.5} />} label="Time" value={event?.time ?? '-'} />
            <Meta icon={<MapPin size={18} strokeWidth={2.5} />} label="Venue" value={showtime?.venue ?? '-'} />
          </dl>

          <div className="seat-count-grid">
            <div>
              <strong>{counts.available}</strong>
              <span>Available</span>
            </div>
            <div>
              <strong>{counts.holding}</strong>
              <span>Held</span>
            </div>
            <div>
              <strong>{counts.sold}</strong>
              <span>Sold</span>
            </div>
          </div>

          <div className="selected-seat-list">
            <span>Selected seats</span>
            {selectedSeats.length === 0 ? (
              <p>No seats selected.</p>
            ) : (
              selectedSeats.map((seat) => (
                <div key={seat.id}>
                  <strong>
                    {seat.row}
                    {seat.number}
                  </strong>
                  <span>{formatCurrency(seat.price)}</span>
                </div>
              ))
            )}
          </div>

          {error && (
            <div className="auth-notice error">
              <span className="auth-notice-icon">
                <AlertCircle size={18} strokeWidth={2.5} />
              </span>
              <p>{error}</p>
            </div>
          )}

          {notice && (
            <div className="auth-notice info">
              <span className="auth-notice-icon">
                <AlertCircle size={18} strokeWidth={2.5} />
              </span>
              <p>{notice}</p>
            </div>
          )}

          <div className="checkout-total">
            <span>Estimated total</span>
            <strong>{formatCurrency(totalAmount)}</strong>
          </div>

          <button className="primary-button" type="button" disabled={selectedSeatIds.length === 0 || isHolding} onClick={onHoldSeats}>
            {isHolding ? 'Holding seats...' : 'Hold for 10 minutes'}
            <span>
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </span>
          </button>
        </aside>
      </div>
    </section>
  )
}

function seatClassTone(seatClass: SeatClass): string {
  if (seatClass === 'DELUXE') return 'deluxe'
  if (seatClass === 'PREMIUM') return 'premium'
  if (seatClass === 'VIP') return 'vip'
  return 'standard'
}

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span>
      <i className={className} />
      {label}
    </span>
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
