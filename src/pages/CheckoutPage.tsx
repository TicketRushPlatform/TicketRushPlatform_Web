import { AlertCircle, ArrowLeft, CheckCircle2, Clock, CreditCard, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { cancelBooking, confirmBooking, formatCurrency, getBookingDetail } from '../services/ticketRushApi'
import type { Booking, Seat, Showtime, TicketRushEvent } from '../types'

type CheckoutDetail = {
  booking: Booking
  event: TicketRushEvent
  showtime: Showtime
  seats: Seat[]
}

export function CheckoutPage() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<CheckoutDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number>(() => new Date().getTime())

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!bookingId) return
      const bookingDetail = await getBookingDetail(bookingId)
      if (cancelled) return
      setDetail(bookingDetail ?? null)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [bookingId])

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date().getTime()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const remainingMs = detail?.booking.expiresAt ? Math.max(0, new Date(detail.booking.expiresAt).getTime() - now) : 0

  useEffect(() => {
    if (!detail || detail.booking.status !== 'HOLDING') return
    if (remainingMs > 0) return
    const timer = window.setTimeout(() => navigate(`/showtimes/${detail.booking.showtimeId}/seats`), 1200)
    return () => window.clearTimeout(timer)
  }, [detail, navigate, remainingMs])

  async function onCancel() {
    if (!bookingId || !detail) return
    await cancelBooking(bookingId)
    navigate(`/showtimes/${detail.booking.showtimeId}/seats`)
  }

  async function onConfirm() {
    if (!bookingId) return
    setIsConfirming(true)
    setError(null)
    try {
      await confirmBooking(bookingId)
      navigate('/tickets')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not confirm checkout.')
    } finally {
      setIsConfirming(false)
    }
  }

  if (isLoading) {
    return (
      <section className="state-page">
        <div className="state-block">
          <div className="state-icon">
            <LoaderCircle className="spin" size={34} strokeWidth={2.5} />
          </div>
          <h1>Loading checkout</h1>
          <p>TicketRush is checking your seat hold timer.</p>
        </div>
      </section>
    )
  }

  if (!detail) {
    return (
      <section className="state-page">
        <div className="state-block">
          <h1>Booking not found</h1>
          <p>This seat hold may have expired or been canceled.</p>
          <Link className="secondary-button" to="/">
            <ArrowLeft size={18} strokeWidth={2.5} />
            Back to Explore
          </Link>
        </div>
      </section>
    )
  }

  const minutes = Math.floor(remainingMs / 60000)
  const seconds = Math.floor((remainingMs % 60000) / 1000)
  const expired = detail.booking.status !== 'HOLDING' || remainingMs === 0

  return (
    <section className="checkout-page" aria-labelledby="checkout-title">
      <Link className="secondary-button compact-link" to={`/showtimes/${detail.booking.showtimeId}/seats`}>
        <ArrowLeft size={18} strokeWidth={2.5} />
        Back to seat map
      </Link>

      <div className="checkout-layout">
        <section className="admin-card checkout-main">
          <p className="eyebrow">
            <CreditCard size={18} strokeWidth={2.5} />
            Simulated Checkout
          </p>
          <h1 id="checkout-title">Confirm your booking.</h1>
          <p className="hero-text">No real payment gateway is connected. Confirming checkout issues QR e-tickets and marks the seats as sold.</p>

          <div className={expired ? 'checkout-timer expired' : 'checkout-timer'}>
            <Clock size={28} strokeWidth={2.5} />
            <div>
              <span>Seat hold expires in</span>
              <strong>
                {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
              </strong>
            </div>
          </div>

          {expired && (
            <div className="auth-notice error">
              <span className="auth-notice-icon">
                <AlertCircle size={18} strokeWidth={2.5} />
              </span>
              <p>This booking expired. You will be sent back to the seat map.</p>
            </div>
          )}

          {error && (
            <div className="auth-notice error">
              <span className="auth-notice-icon">
                <AlertCircle size={18} strokeWidth={2.5} />
              </span>
              <p>{error}</p>
            </div>
          )}
        </section>

        <aside className="admin-card checkout-summary">
          <h2>Order summary</h2>
          <div className="checkout-event">
            <img src={detail.event.imageUrl} alt="" />
            <div>
              <strong>{detail.event.name}</strong>
              <span>{detail.showtime.venue}</span>
            </div>
          </div>

          <div className="selected-seat-list">
            <span>Seats</span>
            {detail.seats.map((seat) => (
              <div key={seat.id}>
                <strong>
                  {seat.row}
                  {seat.number}
                </strong>
                <span>{formatCurrency(seat.price)}</span>
              </div>
            ))}
          </div>

          <div className="checkout-total">
            <span>Total</span>
            <strong>{formatCurrency(detail.booking.totalAmount)}</strong>
          </div>

          <button className="primary-button" type="button" disabled={expired || isConfirming} onClick={onConfirm}>
            {isConfirming ? 'Issuing tickets...' : 'Confirm checkout'}
            <span>
              <CheckCircle2 size={18} strokeWidth={2.5} />
            </span>
          </button>
          <button className="secondary-button cancel-checkout" type="button" disabled={isConfirming} onClick={onCancel}>
            Cancel hold
          </button>

          <div className="auth-note">
            <LockKeyhole size={18} strokeWidth={2.5} />
            After confirmation, selected seats become sold.
          </div>
        </aside>
      </div>
    </section>
  )
}
