import {
  BarChart3,
  CalendarPlus,
  CircleDollarSign,
  ClipboardList,
  Search,
  Ticket,
  TrendingUp,
  UsersRound,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency, formatDate, listEvents } from '../services/ticketRushApi'
import type { EventItem } from '../types'

const metrics = [
  { label: 'Total events', value: '128', detail: '+14 this month', tone: 'violet' },
  { label: 'Tickets sold', value: '42.8k', detail: '86% fulfillment', tone: 'pink' },
  { label: 'Revenue', value: '$1.2M', detail: '+18.4% growth', tone: 'amber' },
  { label: 'Customers', value: '19.6k', detail: '2.1k new', tone: 'mint' },
]

const revenue = [42, 58, 46, 76, 88, 70, 96]
const categoryMix = [
  ['Concert', 38, 'var(--accent)'],
  ['Sports', 24, 'var(--secondary)'],
  ['Festival', 18, 'var(--tertiary)'],
  ['Theater', 12, 'var(--quaternary)'],
]
const funnel = [
  ['Views', 100],
  ['Holds', 68],
  ['Checkout', 42],
  ['Sold', 31],
]

export function AdminDashboardPage() {
  const [query, setQuery] = useState('')
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(true)

  useEffect(() => {
    async function loadInventory() {
      setIsLoadingEvents(true)
      try {
        const payload = await listEvents()
        setEvents(payload)
      } finally {
        setIsLoadingEvents(false)
      }
    }
    loadInventory()
  }, [])

  const visibleEvents = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return events
    return events.filter((event) => [event.name, event.category, event.city, event.venue, event.status].join(' ').toLowerCase().includes(keyword))
  }, [events, query])

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

      <div className="metric-grid">
        {metrics.map((metric) => (
          <article className={`metric-card ${metric.tone}`} key={metric.label}>
            <span className="metric-icon">
              {metric.label === 'Total events' && <Ticket size={24} strokeWidth={2.5} />}
              {metric.label === 'Tickets sold' && <BarChart3 size={24} strokeWidth={2.5} />}
              {metric.label === 'Revenue' && <CircleDollarSign size={24} strokeWidth={2.5} />}
              {metric.label === 'Customers' && <UsersRound size={24} strokeWidth={2.5} />}
            </span>
            <p>{metric.label}</p>
            <strong>{metric.value}</strong>
            <span>{metric.detail}</span>
          </article>
        ))}
      </div>

      <div className="chart-grid">
        <section className="admin-panel chart-panel" aria-labelledby="revenue-title">
          <div className="panel-heading compact">
            <div>
              <h2 id="revenue-title">Revenue pulse</h2>
              <p>Last 7 active selling days.</p>
            </div>
            <TrendingUp size={26} strokeWidth={2.5} />
          </div>
          <div className="bar-chart" aria-label="Revenue bar chart">
            {revenue.map((value, index) => (
              <span key={index} style={{ height: `${value}%` }}>
                <i>{value}</i>
              </span>
            ))}
          </div>
        </section>

        <section className="admin-panel chart-panel" aria-labelledby="category-title">
          <h2 id="category-title">Category mix</h2>
          <div className="donut-wrap">
            <div className="donut-chart" aria-hidden="true" />
            <div className="chart-legend">
              {categoryMix.map(([label, value, color]) => (
                <span key={label}>
                  <i style={{ background: color }} />
                  {label} {value}%
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="admin-panel chart-panel" aria-labelledby="funnel-title">
          <h2 id="funnel-title">Checkout funnel</h2>
          <div className="funnel-chart">
            {funnel.map(([label, value]) => (
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
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events" aria-label="Search admin events" />
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
            {isLoadingEvents && <div className="table-row" role="row"><span role="cell">Loading...</span></div>}
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
          <div className="queue-item">
            <strong>12</strong>
            <span>Pending venue approvals</span>
          </div>
          <div className="queue-item">
            <strong>7</strong>
            <span>Events need hero images</span>
          </div>
          <div className="queue-item">
            <strong>3</strong>
            <span>Price rules expiring today</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
