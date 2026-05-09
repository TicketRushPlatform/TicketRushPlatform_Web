import { AlertCircle, ArrowLeft, CheckCircle2, Clock, CreditCard, LoaderCircle, LockKeyhole } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useBeforeUnload, useLocation, useNavigate, useParams } from 'react-router-dom'
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
  const location = useLocation()
  const [detail, setDetail] = useState<CheckoutDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [now, setNow] = useState<number>(() => new Date().getTime())
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false)
  const autoCancelOnLeaveRef = useRef(true)
  const leavePayloadRef = useRef<{ bookingId?: string; canCancel: boolean }>({ canCancel: false })
  const pendingNavigationRef = useRef<{ type: 'path'; to: string } | { type: 'back' } | null>(null)
  const bypassPopstateGuardRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!bookingId) return
      try {
        const bookingDetail = await getBookingDetail(bookingId)
        if (cancelled) return
        setDetail(bookingDetail ?? null)
      } catch (err) {
        if (cancelled) return
        setDetail(null)
        setError(err instanceof Error ? err.message : 'You do not have permission to access this booking.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
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
  const shouldWarnBeforeLeave = Boolean(detail && detail.booking.status === 'HOLDING' && remainingMs > 0 && !isConfirming)

  useBeforeUnload((event) => {
    if (!shouldWarnBeforeLeave) return
    event.preventDefault()
    event.returnValue = ''
  })

  useEffect(() => {
    if (!shouldWarnBeforeLeave) return

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const target = event.target as Element | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) return

      const nextUrl = new URL(anchor.href, window.location.origin)
      const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
      const targetPath = `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`
      if (nextUrl.origin !== window.location.origin || targetPath === currentUrl) return

      event.preventDefault()
      pendingNavigationRef.current = { type: 'path', to: targetPath }
      setIsLeaveModalOpen(true)
    }

    const onPopState = () => {
      if (bypassPopstateGuardRef.current) return
      pendingNavigationRef.current = { type: 'back' }
      setIsLeaveModalOpen(true)
      history.go(1)
    }

    document.addEventListener('click', onDocumentClick, true)
    window.addEventListener('popstate', onPopState)
    history.pushState({ checkoutGuard: true }, '', window.location.href)

    return () => {
      document.removeEventListener('click', onDocumentClick, true)
      window.removeEventListener('popstate', onPopState)
    }
  }, [shouldWarnBeforeLeave, location.key])

  useEffect(() => {
    leavePayloadRef.current = {
      bookingId,
      canCancel: shouldWarnBeforeLeave,
    }
  }, [bookingId, shouldWarnBeforeLeave])

  useEffect(() => {
    return () => {
      if (!autoCancelOnLeaveRef.current) return
      const { bookingId: leavingBookingId, canCancel } = leavePayloadRef.current
      if (!canCancel || !leavingBookingId) return
      void cancelBooking(leavingBookingId)
    }
  }, [])

  useEffect(() => {
    if (!detail || detail.booking.status !== 'HOLDING') return
    if (remainingMs > 0) return
    const timer = window.setTimeout(() => navigate(`/showtimes/${detail.booking.showtimeId}/seats?holdExpired=1`), 1200)
    return () => window.clearTimeout(timer)
  }, [detail, navigate, remainingMs])

  async function onCancel() {
    if (!bookingId || !detail) return
    autoCancelOnLeaveRef.current = false
    await cancelBooking(bookingId)
    navigate(`/showtimes/${detail.booking.showtimeId}/seats`)
  }

  function onBackToSeatMap() {
    if (!detail) return
    const to = `/showtimes/${detail.booking.showtimeId}/seats`
    if (!shouldWarnBeforeLeave) {
      navigate(to)
      return
    }
    pendingNavigationRef.current = { type: 'path', to }
    setIsLeaveModalOpen(true)
  }

  function onStayOnCheckout() {
    pendingNavigationRef.current = null
    setIsLeaveModalOpen(false)
  }

  function onLeaveAndCancelHold() {
    const pendingNavigation = pendingNavigationRef.current
    pendingNavigationRef.current = null
    setIsLeaveModalOpen(false)
    if (!pendingNavigation) return
    if (pendingNavigation.type === 'path') {
      navigate(pendingNavigation.to)
      return
    }
    bypassPopstateGuardRef.current = true
    history.back()
  }

  async function onConfirm() {
    if (!bookingId) return
    setIsConfirming(true)
    setError(null)
    try {
      await confirmBooking(bookingId)
      autoCancelOnLeaveRef.current = false
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
          <p>{error ?? 'This seat hold may have expired, been canceled, or you do not have permission to view it.'}</p>
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
      <button className="secondary-button compact-link" type="button" onClick={onBackToSeatMap}>
        <ArrowLeft size={18} strokeWidth={2.5} />
        Back to seat map
      </button>

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

      {isLeaveModalOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={onStayOnCheckout}>
          <section className="qr-modal leave-checkout-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Leave checkout?</h2>
            <p>Nếu rời trang này, hệ thống sẽ tự động hủy giữ ghế hiện tại của bạn.</p>
            <div className="checkout-actions">
              <button className="secondary-button" type="button" onClick={onStayOnCheckout}>
                Ở lại trang
              </button>
              <button className="primary-button" type="button" onClick={onLeaveAndCancelHold}>
                Rời trang và hủy giữ ghế
                <span>
                  <AlertCircle size={18} strokeWidth={2.5} />
                </span>
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  )
}

