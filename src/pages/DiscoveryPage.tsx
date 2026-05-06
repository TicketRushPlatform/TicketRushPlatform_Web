import {
  AlertCircle,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock,
  Frown,
  LoaderCircle,
  MapPin,
  Mic,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Ticket,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { formatCurrency, formatDate, listEvents } from '../services/ticketRushApi'
import type { EventItem } from '../types'

const pageSize = 6
type SortOption = 'date-asc' | 'price-asc' | 'price-desc' | 'name-asc'
const sortOptions: Array<{ value: SortOption; label: string }> = [
  { value: 'date-asc', label: 'Soonest first' },
  { value: 'price-asc', label: 'Lowest price' },
  { value: 'price-desc', label: 'Highest price' },
  { value: 'name-asc', label: 'A to Z' },
]

export function DiscoveryPage() {
  const [events, setEvents] = useState<EventItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [date, setDate] = useState('')
  const [sort, setSort] = useState<SortOption>('date-asc')
  const [page, setPage] = useState(1)
  const [featuredIndex, setFeaturedIndex] = useState(0)
  const [isFeaturedSwitching, setIsFeaturedSwitching] = useState(false)

  useEffect(() => {
    loadEvents()
  }, [])

  useEffect(() => {
    setFeaturedIndex(0)
  }, [events.length])

  useEffect(() => {
    if (events.length <= 1) return

    let timeoutId: number | null = null

    const intervalId = window.setInterval(() => {
      setIsFeaturedSwitching(true)

      timeoutId = window.setTimeout(() => {
        setFeaturedIndex((currentIndex) => (currentIndex + 1) % events.length)
        setIsFeaturedSwitching(false)
      }, 320)
    }, 10000)

    return () => {
      window.clearInterval(intervalId)
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [events.length])

  async function loadEvents() {
    setIsLoading(true)
    setError(null)

    try {
      const eventList = await listEvents()
      setEvents(eventList)
    } catch {
      setError('We could not load events right now. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredEvents = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()

    return events
      .filter((event) => {
        const searchableText = [
          event.name,
          event.category,
          event.city,
          event.venue,
          event.date,
          formatDate(event.date),
          ...event.tags,
        ]
          .join(' ')
          .toLowerCase()

        return (
          (!normalizedQuery || searchableText.includes(normalizedQuery)) &&
          (!category || event.category === category) &&
          (!date || event.date === date)
        )
      })
      .sort((first, second) => {
        if (sort === 'price-asc') return first.priceFrom - second.priceFrom
        if (sort === 'price-desc') return second.priceFrom - first.priceFrom
        if (sort === 'name-asc') return first.name.localeCompare(second.name)
        return first.date.localeCompare(second.date)
      })
  }, [category, date, events, query, sort])
  const availableCategories = useMemo(
    () => [...new Set(events.map((event) => event.category))].sort((first, second) => first.localeCompare(second)),
    [events],
  )
  const availableDates = useMemo(
    () => [...new Set(events.map((event) => event.date))].sort((first, second) => first.localeCompare(second)),
    [events],
  )

  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / pageSize))
  const visibleEvents = filteredEvents.slice((page - 1) * pageSize, page * pageSize)
  const hasFilters = Boolean(query || category || date || sort !== 'date-asc')
  const featuredEvent = events[featuredIndex]

  function resetFilters() {
    setQuery('')
    setCategory('')
    setDate('')
    setSort('date-asc')
    setPage(1)
  }

  return (
    <>
      <section className="hero-section" aria-labelledby="page-title">
        <div className="confetti confetti-one" aria-hidden="true" />
        <div className="confetti confetti-two" aria-hidden="true" />
        <div className="confetti confetti-three" aria-hidden="true" />

        {featuredEvent ? (
          <FeaturedEvent
            key={featuredEvent.id}
            event={featuredEvent}
            isSwitching={isFeaturedSwitching}
          />
        ) : (
          <div className="featured-event-card loading-feature">
            <LoaderCircle className="spin" size={34} strokeWidth={2.5} />
            <span>Loading main event</span>
          </div>
        )}
      </section>

      <section className="discovery-section" aria-labelledby="discover-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">
              <SlidersHorizontal size={18} strokeWidth={2.5} />
              Browse events
            </p>
            <h2 id="discover-title">Discover tickets</h2>
          </div>
          <p>
            {filteredEvents.length} {filteredEvents.length === 1 ? 'event' : 'events'} found
          </p>
        </div>

        <form className="filters" onSubmit={(event) => event.preventDefault()}>
          <label className="field search-field">
            <span>Search</span>
            <div className="input-shell search-with-mic">
              <Search size={20} strokeWidth={2.5} aria-hidden="true" />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value)
                  setPage(1)
                }}
                placeholder="Name, date, category, city..."
              />
              <Link className="mic-search-button" to="/sound-search" aria-label="Find movie by humming">
                <Mic size={19} strokeWidth={2.5} />
              </Link>
            </div>
          </label>

          <label className="field">
            <span>Category</span>
            <FilterSelect
              value={category}
              valueLabel={category || 'All categories'}
              placeholder="All categories"
              ariaLabel="Filter by category"
              options={availableCategories.map((item) => ({ value: item, label: item }))}
              onChange={(value) => {
                setCategory(value)
                setPage(1)
              }}
            />
          </label>

          <label className="field">
            <span>Date</span>
            <DateFilterCalendar
              value={date}
              valueLabel={date ? formatDate(date) : 'All dates'}
              placeholder="All dates"
              ariaLabel="Filter by date"
              availableDates={availableDates}
              onChange={(value) => {
                setDate(value)
                setPage(1)
              }}
            />
          </label>

          <label className="field">
            <span>Sort</span>
            <FilterSelect
              value={sort}
              valueLabel={sortOptions.find((option) => option.value === sort)?.label ?? 'Soonest first'}
              ariaLabel="Sort events"
              options={sortOptions}
              onChange={(value) => {
                setSort(value as SortOption)
                setPage(1)
              }}
            />
          </label>
        </form>

        {isLoading ? (
          <StateBlock
            icon={<LoaderCircle className="spin" size={34} strokeWidth={2.5} />}
            title="Loading the lineup"
            text="Pulling the newest events into place."
          />
        ) : error ? (
          <StateBlock
            icon={<AlertCircle size={34} strokeWidth={2.5} />}
            title="Events missed the stage"
            text={error}
            action={
              <button className="secondary-button" type="button" onClick={loadEvents}>
                <RotateCcw size={18} strokeWidth={2.5} />
                Retry
              </button>
            }
          />
        ) : visibleEvents.length === 0 ? (
          <StateBlock
            icon={<Frown size={34} strokeWidth={2.5} />}
            title="No matching events"
            text="Try a different search, date, or sort option."
            action={
              hasFilters ? (
                <button className="secondary-button" type="button" onClick={resetFilters}>
                  <RotateCcw size={18} strokeWidth={2.5} />
                  Clear filters
                </button>
              ) : undefined
            }
          />
        ) : (
          <>
            <div className="event-grid">
              {visibleEvents.map((event, index) => (
                <EventCard
                  event={event}
                  key={event.id}
                  index={index}
                />
              ))}
            </div>

            <nav className="pagination" aria-label="Event pages">
              <button
                className="icon-button"
                type="button"
                onClick={() => setPage((currentPage) => Math.max(1, currentPage - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                className="icon-button"
                type="button"
                onClick={() => setPage((currentPage) => Math.min(totalPages, currentPage + 1))}
                disabled={page === totalPages}
                aria-label="Next page"
              >
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </nav>
          </>
        )}
      </section>

    </>
  )
}

function FeaturedEvent({
  event,
  isSwitching,
}: {
  event: EventItem
  isSwitching: boolean
}) {
  const soldPercent = Math.round((event.sold / event.capacity) * 100)

  return (
    <article className={isSwitching ? 'featured-event-card is-switching' : 'featured-event-card'} aria-labelledby="page-title">
      <div className="featured-poster">
        <img src={event.imageUrl} alt="" />
        <span className="status-pill">{event.status}</span>
      </div>

      <div className="featured-info">
        <p className="eyebrow">
          <Sparkles size={18} strokeWidth={2.5} />
          Main event
        </p>
        <h1 className="featured-title" id="page-title">
          <span>{event.name}</span>
        </h1>
        <p className="hero-text">{event.description}</p>

        <dl className="featured-meta">
          <Meta icon={<CalendarDays size={18} strokeWidth={2.5} />} label="Date" value={formatDate(event.date)} />
          <Meta icon={<Clock size={18} strokeWidth={2.5} />} label="Time" value={event.time} />
          <Meta icon={<MapPin size={18} strokeWidth={2.5} />} label="Venue" value={`${event.venue}, ${event.city}`} />
          <Meta icon={<CircleDollarSign size={18} strokeWidth={2.5} />} label="From" value={formatCurrency(event.priceFrom)} />
        </dl>

        <div className="featured-sales">
          <div>
            <strong>{soldPercent}%</strong>
            <span>sold</span>
          </div>
          <div className="capacity-bar" aria-label={`${soldPercent}% sold`}>
            <span style={{ width: `${soldPercent}%` }} />
          </div>
        </div>

        <Link className="primary-button featured-cta" to={`/events/${event.id}`}>
          View tickets
          <span>
            <Ticket size={18} strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </article>
  )
}

function EventCard({
  event,
  index,
}: {
  event: EventItem
  index: number
}) {
  const tone = ['violet', 'pink', 'amber', 'mint'][index % 4]

  return (
    <article className={`event-card ${tone}`}>
      <div className="event-art">
        <img src={event.imageUrl} alt="" />
        <span className="status-pill">{event.status}</span>
      </div>
      <div className="event-body">
        <div className="card-topline">
          <span>{event.category}</span>
          <span>{event.city}</span>
        </div>
        <h3>{event.name}</h3>
        <dl className="event-meta">
          <Meta icon={<CalendarDays size={18} strokeWidth={2.5} />} label="Date" value={formatDate(event.date)} />
          <Meta icon={<Clock size={18} strokeWidth={2.5} />} label="Time" value={event.time} />
          <Meta icon={<MapPin size={18} strokeWidth={2.5} />} label="Venue" value={event.venue} />
          <Meta icon={<CircleDollarSign size={18} strokeWidth={2.5} />} label="Price" value={`From $${event.priceFrom}`} />
        </dl>
        <Link className="primary-button" to={`/events/${event.id}`}>
          View tickets
          <span>
            <ArrowRight size={18} strokeWidth={2.5} />
          </span>
        </Link>
      </div>
    </article>
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

function FilterSelect({
  value,
  valueLabel,
  options,
  placeholder = 'Select',
  ariaLabel,
  onChange,
}: {
  value: string
  valueLabel: string
  options: Array<{ value: string; label: string }>
  placeholder?: string
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className={isOpen ? 'filter-select open' : 'filter-select'} ref={wrapperRef}>
      <button
        className="filter-select-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{valueLabel || placeholder}</span>
        <ChevronDown size={18} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="filter-select-menu" role="listbox" aria-label={ariaLabel}>
          <button
            className={value === '' ? 'filter-option active' : 'filter-option'}
            type="button"
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
          >
            {placeholder}
          </button>
          {options.map((option) => (
            <button
              className={option.value === value ? 'filter-option active' : 'filter-option'}
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DateFilterCalendar({
  value,
  valueLabel,
  placeholder = 'All dates',
  ariaLabel,
  availableDates,
  onChange,
}: {
  value: string
  valueLabel: string
  placeholder?: string
  ariaLabel: string
  availableDates: string[]
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const eventDateSet = useMemo(() => new Set(availableDates), [availableDates])
  const [visibleMonth, setVisibleMonth] = useState(() => {
    if (!availableDates.length) {
      const today = new Date()
      return new Date(today.getFullYear(), today.getMonth(), 1)
    }
    return getMonthStartFromISO(availableDates[0])
  })

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (!value) return
    setVisibleMonth(getMonthStartFromISO(value))
  }, [value])

  useEffect(() => {
    if (value || !availableDates.length) return
    setVisibleMonth(getMonthStartFromISO(availableDates[0]))
  }, [availableDates, value])

  const days = useMemo(() => {
    const firstVisible = startOfWeek(visibleMonth)
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(firstVisible)
      day.setDate(firstVisible.getDate() + index)
      return day
    })
  }, [visibleMonth])

  const hasPreviousMonth = useMemo(
    () => availableDates.length > 0 && visibleMonth > getMonthStartFromISO(availableDates[0]),
    [availableDates, visibleMonth],
  )
  const hasNextMonth = useMemo(
    () => availableDates.length > 0 && visibleMonth < getMonthStartFromISO(availableDates[availableDates.length - 1]),
    [availableDates, visibleMonth],
  )

  return (
    <div className={isOpen ? 'filter-select calendar-filter open' : 'filter-select calendar-filter'} ref={wrapperRef}>
      <button
        className="filter-select-trigger"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{valueLabel || placeholder}</span>
        <ChevronDown size={18} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="calendar-menu" role="dialog" aria-label={ariaLabel}>
          <div className="calendar-header">
            <button
              className="tiny-calendar-nav"
              type="button"
              disabled={!hasPreviousMonth}
              onClick={() => setVisibleMonth((month) => addMonths(month, -1))}
              aria-label="Previous month"
            >
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <strong>{formatMonthYear(visibleMonth)}</strong>
            <button
              className="tiny-calendar-nav"
              type="button"
              disabled={!hasNextMonth}
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}
              aria-label="Next month"
            >
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
          </div>
          <div className="calendar-weekdays">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {days.map((day) => {
              const isoValue = toISODate(day)
              const inMonth = day.getMonth() === visibleMonth.getMonth()
              const isAvailable = eventDateSet.has(isoValue)
              const isActive = value === isoValue
              const isToday = toISODate(day) === toISODate(new Date())
              return (
                <button
                  className={[
                    'calendar-day',
                    inMonth ? '' : 'outside',
                    isAvailable ? 'available' : '',
                    isActive ? 'active' : '',
                    isToday ? 'today' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  key={isoValue}
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => {
                    onChange(isoValue)
                    setIsOpen(false)
                  }}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>
          <button
            className="calendar-clear"
            type="button"
            onClick={() => {
              onChange('')
              setIsOpen(false)
            }}
          >
            Clear date filter
          </button>
        </div>
      )}
    </div>
  )
}

function StateBlock({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <div className="state-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}

function parseISODate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function getMonthStartFromISO(value: string) {
  const date = parseISODate(value)
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

function addMonths(date: Date, offset: number) {
  return new Date(date.getFullYear(), date.getMonth() + offset, 1)
}

function startOfWeek(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1)
  firstDay.setDate(firstDay.getDate() - firstDay.getDay())
  return firstDay
}

function toISODate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatMonthYear(date: Date) {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}
