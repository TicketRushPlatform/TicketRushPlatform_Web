import QRCode from 'qrcode'
import { CalendarDays, LoaderCircle, MapPin, QrCode, TicketCheck, X } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthContext'
import { formatCurrency, formatDate, listTickets } from '../services/ticketRushApi'
import type { Booking, Seat, Showtime, Ticket, TicketRushEvent } from '../types'

type TicketBundle = {
  booking: Booking
  event: TicketRushEvent
  showtime: Showtime
  seats: Seat[]
  tickets: Ticket[]
}

export function MyTicketsPage() {
  const auth = useAuth()
  const [bundles, setBundles] = useState<TicketBundle[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTicket, setActiveTicket] = useState<{ ticket: Ticket; event: TicketRushEvent; seat?: Seat } | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const ticketBundles = await listTickets(auth.user?.id)
      if (cancelled) return
      setBundles(ticketBundles)
      setIsLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [auth.user?.id])

  if (isLoading) {
    return (
      <section className="state-page">
        <div className="state-block">
          <div className="state-icon">
            <LoaderCircle className="spin" size={34} strokeWidth={2.5} />
          </div>
          <h1>Loading e-tickets</h1>
          <p>TicketRush is preparing QR codes for paid bookings.</p>
        </div>
      </section>
    )
  }

  const paidBundles = bundles.filter((bundle) => bundle.booking.status === 'PAID' && bundle.tickets.length > 0)

  return (
    <section className="tickets-page" aria-labelledby="tickets-title">
      <div className="admin-hero">
        <div>
          <p className="eyebrow">
            <TicketCheck size={18} strokeWidth={2.5} />
            My Tickets
          </p>
          <h1 id="tickets-title">QR e-tickets.</h1>
        </div>
      </div>
      {paidBundles.length === 0 ? (
        <div className="state-block">
          <h2>No paid tickets yet</h2>
          <p>Confirm checkout to issue QR tickets and view them here.</p>
        </div>
      ) : (
        <div className="ticket-bundle-grid">
          {paidBundles.map((bundle) =>
            bundle.tickets.map((ticket) => {
              const seat = bundle.seats.find((item) => item.id === ticket.seatId)
              return (
                <article className="e-ticket-card" key={ticket.id}>
                  <div className="e-ticket-art">
                    <img src={bundle.event.imageUrl} alt="" />
                    <span className="status-pill">Paid</span>
                  </div>
                  <div className="e-ticket-body">
                    <div>
                      <h2>{bundle.event.name}</h2>
                      <p>{ticket.ticketCode}</p>
                    </div>

                    <dl className="ticket-facts">
                      <Meta icon={<CalendarDays size={18} strokeWidth={2.5} />} label="Date" value={formatDate(bundle.event.date)} />
                      <Meta icon={<MapPin size={18} strokeWidth={2.5} />} label="Venue" value={bundle.showtime.venue} />
                      <Meta icon={<TicketCheck size={18} strokeWidth={2.5} />} label="Seat" value={seat ? `${seat.row}${seat.number}` : '-'} />
                      <Meta icon={<QrCode size={18} strokeWidth={2.5} />} label="Price" value={seat ? formatCurrency(seat.price) : '-'} />
                    </dl>

                    <TicketQr payload={ticket.qrPayload} />

                    <button className="primary-button" type="button" onClick={() => setActiveTicket({ ticket, event: bundle.event, seat })}>
                      Open QR
                      <span>
                        <QrCode size={18} strokeWidth={2.5} />
                      </span>
                    </button>
                  </div>
                </article>
              )
            }),
          )}
        </div>
      )}

      {activeTicket && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setActiveTicket(null)}>
          <section className="qr-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" type="button" onClick={() => setActiveTicket(null)} aria-label="Close QR">
              <X size={22} strokeWidth={2.5} />
            </button>
            <h2>{activeTicket.event.name}</h2>
            <p>{activeTicket.ticket.ticketCode}</p>
            <TicketQr payload={activeTicket.ticket.qrPayload} large />
            <span>{activeTicket.seat ? `Seat ${activeTicket.seat.row}${activeTicket.seat.number}` : 'TicketRush pass'}</span>
          </section>
        </div>
      )}
    </section>
  )
}

function TicketQr({ payload, large = false }: { payload: string; large?: boolean }) {
  const [src, setSrc] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const dataUrl = await QRCode.toDataURL(payload, {
        width: large ? 320 : 160,
        margin: 2,
        color: { dark: '#111827', light: '#ffffff' },
      })
      if (!cancelled) setSrc(dataUrl)
    })()

    return () => {
      cancelled = true
    }
  }, [large, payload])

  return <div className={large ? 'ticket-qr large' : 'ticket-qr'}>{src ? <img src={src} alt="QR e-ticket" /> : <LoaderCircle className="spin" size={24} />}</div>
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
