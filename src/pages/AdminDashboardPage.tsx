import {
  AlertCircle,
  BarChart3,
  CalendarPlus,
  CircleDollarSign,
  ClipboardList,
  Loader2,
  Search,
  Ticket,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { formatCurrency, formatDate, listEvents, getAdminDashboardStats, getTotalEventsCount, type AdminDashboardStats } from '../services/ticketRushApi'
import { getUserStats, type UserStats } from '../services/userApi'
import type { EventItem } from '../types'

// v2 – real API dashboard

function formatRevenue(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B VND`
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M VND`
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(0)}K VND`
  return `${amount.toLocaleString()} VND`
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function AdminDashboardPage() {
  const { tokens } = useAuth()
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)
  const [totalEventsCount, setTotalEventsCount] = useState<number | null>(null)
  const [stats, setStats] = useState<AdminDashboardStats | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoadingStats, setIsLoadingStats] = useState(true)
  const [statsError, setStatsError] = useState<string | null>(null)

  // Load events for the table
  useEffect(() => {
    async function loadInventory() {
      setIsLoadingEvents(true)
      try {
        const payload = await listEvents()
        setEvents(payload)
        // Also fetch total count (may be > 40 loaded events)
        const total = await getTotalEventsCount()
        setTotalEventsCount(total > 0 ? total : payload.length)
      } catch {
        // ignore, events will be empty
      } finally {
        setIsLoadingEvents(false)
      }
    }
    loadInventory()
  }, [])

  // Load real dashboard stats
  useEffect(() => {
    async function loadStats() {
      setIsLoadingStats(true)
      setStatsError(null)
      try {
        const [bookingStats, uStats] = await Promise.all([
          getAdminDashboardStats(),
          tokens?.access_token ? getUserStats(tokens.access_token) : Promise.resolve(null),
        ])
        setStats(bookingStats)
        setUserStats(uStats)
      } catch (err) {
        setStatsError(err instanceof Error ? err.message : 'Failed to load dashboard stats')
      } finally {
        setIsLoadingStats(false)
      }
    }
    loadStats()
  }, [tokens?.access_token])

  const visibleEvents = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return events
    return events.filter((event) =>
      [event.name, event.category, event.city, event.venue, event.status].join(' ').toLowerCase().includes(keyword),
    )
  }, [events, query])

  // Derived metrics from real data
  const totalEvents = totalEventsCount ?? events.length
  const ticketsSold = stats?.tickets_sold ?? 0
  const totalRevenue = stats?.total_revenue ?? 0
  const totalUsers = userStats?.total_users ?? stats?.paid_bookings ?? 0
  const totalSeats = stats?.total_seats ?? 1
  const fillRatePct = totalSeats > 0 ? Math.round((ticketsSold / totalSeats) * 100) : 0

  const metricCards = [
    {
      label: 'Total events',
      value: isLoadingEvents ? '—' : formatCompact(totalEvents),
      detail: isLoadingEvents ? 'Loading…' : `${events.filter((e) => e.status === 'Available' || e.status === 'Flash Sale').length} active`,
      tone: 'violet',
      icon: <Ticket size={24} strokeWidth={2.5} />,
    },
    {
      label: 'Tickets sold',
      value: isLoadingStats ? '—' : formatCompact(ticketsSold),
      detail: isLoadingStats ? 'Loading…' : `${fillRatePct}% fill rate`,
      tone: 'pink',
      icon: <BarChart3 size={24} strokeWidth={2.5} />,
    },
    {
      label: 'Revenue',
      value: isLoadingStats ? '—' : formatRevenue(totalRevenue),
      detail: isLoadingStats ? 'Loading…' : `${stats?.paid_bookings ?? 0} paid bookings`,
      tone: 'amber',
      icon: <CircleDollarSign size={24} strokeWidth={2.5} />,
    },
    {
      label: 'Customers',
      value: isLoadingStats ? '—' : formatCompact(totalUsers),
      detail: isLoadingStats ? 'Loading…' : `${userStats?.active_users ?? 0} active`,
      tone: 'mint',
      icon: <UsersRound size={24} strokeWidth={2.5} />,
    },
  ]

  // Revenue bar chart from real 7-day series
  const revenueSeries = stats?.revenue_series ?? []
  const maxRevenue = revenueSeries.length > 0 ? Math.max(...revenueSeries.map((p) => p.revenue), 1) : 1
  const revenueBarHeights = revenueSeries.map((p) => Math.max(4, Math.round((p.revenue / maxRevenue) * 100)))

  // Category mix from loaded events
  const categoryTotals = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.category] = (acc[event.category] ?? 0) + 1
    return acc
  }, {})
  const categoryEntries = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 4)
  const totalForMix = categoryEntries.reduce((sum, [, v]) => sum + v, 0) || 1
  const categoryColors = ['var(--accent)', 'var(--secondary)', 'var(--tertiary, var(--primary))', 'var(--quaternary, var(--foreground))']

  // Checkout funnel from real seat data
  const funnelData: [string, number][] = stats
    ? [
        ['Total seats', 100],
        ['Available', totalSeats > 0 ? Math.round((stats.available_seats / totalSeats) * 100) : 0],
        ['Holding', totalSeats > 0 ? Math.round(((stats.holding_seats + stats.sold_seats) / totalSeats) * 100) : 0],
        ['Sold', totalSeats > 0 ? Math.round((stats.sold_seats / totalSeats) * 100) : 0],
      ]
    : [
        ['Views', 100],
        ['Holds', 68],
        ['Checkout', 42],
        ['Sold', 31],
      ]

  // Ops queue derived from real data
  const pendingHolds = stats?.holding_bookings ?? 0
  const pendingSeats = stats?.holding_seats ?? 0
  const eventsNoImage = events.filter((e) => !e.imageUrl || e.imageUrl.includes('unsplash')).length
  const canceledBookings = stats?.canceled_bookings ?? 0

  return (
    <section className="admin-page" aria-labelledby="admin-title">
      <div className="admin-hero">
        <div>
          <p className="eyebrow">
            <ClipboardList size={18} strokeWidth={2.5} />
            Admin dashboard
          </p>
          <h1 id="admin-title">Control room for every ticket drop.</h1>
        </div>
        <Link className="primary-button compact-button" to="/admin/events/new">
          New event
          <span>
            <CalendarPlus size={18} strokeWidth={2.5} />
          </span>
        </Link>
      </div>

      {statsError && (
        <div
          className="admin-panel"
          style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--warning, #f59e0b)', marginBottom: '1.5rem' }}
        >
          <AlertCircle size={20} />
          <span>Could not load live stats: {statsError}. Showing cached or partial data.</span>
        </div>
      )}

      <div className="metric-grid">
        {metricCards.map((metric) => (
          <article className={`metric-card ${metric.tone}`} key={metric.label}>
            <span className="metric-icon">{metric.icon}</span>
            <p>{metric.label}</p>
            <strong>
              {isLoadingStats && metric.label !== 'Total events' ? (
                <Loader2 size={18} className="spin" style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }} />
              ) : (
                metric.value
              )}
            </strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </div>

      <div className="chart-grid">
        <section className="admin-panel chart-panel" aria-labelledby="revenue-title">
          <div className="panel-heading compact">
            <div>
              <h2 id="revenue-title">Revenue pulse</h2>
              <p>Last 7 days of confirmed bookings.</p>
            </div>
            <TrendingUp size={26} strokeWidth={2.5} />
          </div>
          <div className="bar-chart" aria-label="Revenue bar chart">
            {isLoadingStats ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)' }}>
                <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                Loading…
              </div>
            ) : revenueSeries.length > 0 ? (
              revenueSeries.map((point, index) => (
                <span key={index} style={{ height: `${revenueBarHeights[index]}%` }} title={`${point.date}: ${formatRevenue(point.revenue)}`}>
                  <i>{point.revenue > 0 ? formatRevenue(point.revenue) : '0'}</i>
                </span>
              ))
            ) : (
              // Placeholder bars when no revenue data yet
              [8, 12, 5, 20, 15, 10, 18].map((v, i) => (
                <span key={i} style={{ height: `${v}%`, opacity: 0.3 }}>
                  <i>0</i>
                </span>
              ))
            )}
          </div>
        </section>

        <section className="admin-panel chart-panel" aria-labelledby="category-title">
          <h2 id="category-title">Category mix</h2>
          <div className="donut-wrap">
            <div className="donut-chart" aria-hidden="true" />
            <div className="chart-legend">
              {isLoadingEvents ? (
                <span style={{ color: 'var(--muted-foreground)' }}>Loading…</span>
              ) : categoryEntries.length > 0 ? (
                categoryEntries.map(([label, count], idx) => (
                  <span key={label}>
                    <i style={{ background: categoryColors[idx % categoryColors.length] }} />
                    {label} {Math.round((count / totalForMix) * 100)}%
                  </span>
                ))
              ) : (
                <span style={{ color: 'var(--muted-foreground)' }}>No events yet</span>
              )}
            </div>
          </div>
        </section>

        <section className="admin-panel chart-panel" aria-labelledby="funnel-title">
          <h2 id="funnel-title">Seat funnel</h2>
          <div className="funnel-chart">
            {funnelData.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}%</strong>
                <i style={{ width: `${value}%` }} />
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="admin-layout">
        <section className="admin-panel" aria-labelledby="events-table-title">
          <div className="panel-heading">
            <div>
              <h2 id="events-table-title">Event inventory</h2>
              <p>Manage listings, capacity, and ticket price floors.</p>
            </div>
            <div className="table-search">
              <Search size={18} strokeWidth={2.5} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events"
                aria-label="Search admin events"
              />
            </div>
          </div>

          <div className="event-table" role="table" aria-label="Admin events">
            <div className="table-row table-head" role="row">
              <span role="columnheader">Event</span>
              <span role="columnheader">Category</span>
              <span role="columnheader">Date</span>
              <span role="columnheader">Status</span>
              <span role="columnheader">From</span>
              <span role="columnheader">Actions</span>
            </div>
            {isLoadingEvents && (
              <div className="table-row" role="row">
                <span role="cell" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Loading events…
                </span>
              </div>
            )}
            {!isLoadingEvents && visibleEvents.length === 0 && (
              <div className="table-row" role="row">
                <span role="cell" style={{ color: 'var(--muted-foreground)' }}>
                  {query ? 'No events match your search.' : 'No events found.'}
                </span>
              </div>
            )}
            {!isLoadingEvents &&
              visibleEvents.map((event) => (
                <div className="table-row" role="row" key={event.id}>
                  <span role="cell">{event.name}</span>
                  <span role="cell">{event.category}</span>
                  <span role="cell">{formatDate(event.date)}</span>
                  <span role="cell">{event.status}</span>
                  <span role="cell">{formatCurrency(event.priceFrom)}</span>
                  <Link className="secondary-button compact-link" to={`/admin/events/${event.id}/edit`}>
                    Edit
                  </Link>
                </div>
              ))}
          </div>
        </section>

        <aside className="admin-panel side-panel" aria-labelledby="ops-title">
          <h2 id="ops-title">Ops queue</h2>

          {isLoadingStats ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted-foreground)' }}>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Loading…
            </div>
          ) : (
            <>
              <div className="queue-item">
                <strong>{pendingHolds}</strong>
                <span>Pending hold bookings</span>
              </div>
              <div className="queue-item">
                <strong>{pendingSeats}</strong>
                <span>Seats currently held</span>
              </div>
              <div className="queue-item">
                <strong>{eventsNoImage}</strong>
                <span>Events using default images</span>
              </div>
              <div className="queue-item">
                <strong>{canceledBookings}</strong>
                <span>Canceled bookings</span>
              </div>
              {stats && (
                <div className="queue-item">
                  <strong>{stats.expired_bookings}</strong>
                  <span>Expired bookings</span>
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </section>
  )
}
