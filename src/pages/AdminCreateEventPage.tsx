import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ImagePlus,
  Plus,
  Save,
  Trash2,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { createEvent, getEvent, getShowtimesByEvent, updateEvent } from '../services/ticketRushApi'
import type { EventCategory, TicketStatus } from '../types'

const availableSeatMaps = [
  { id: 'concert-main', label: 'Concert Main Hall', venue: 'TicketRush Arena', address: 'District 1, Ho Chi Minh City' },
  { id: 'theater-classic', label: 'Classic Theater', venue: 'Grand Theater', address: 'District 3, Ho Chi Minh City' },
  { id: 'stadium-open', label: 'Open Stadium', venue: 'City Stadium', address: 'District 7, Ho Chi Minh City' },
]

export function AdminCreateEventPage() {
  const { eventId } = useParams<{ eventId: string }>()
  const isEditMode = Boolean(eventId)
  const [eventName, setEventName] = useState('')
  const [category, setCategory] = useState<EventCategory>('Music')
  const [status, setStatus] = useState<TicketStatus>('Available')
  const [city, setCity] = useState('Ho Chi Minh City')
  const [description, setDescription] = useState('')
  const [posterPreviewUrl, setPosterPreviewUrl] = useState('')
  const [showtimes, setShowtimes] = useState<Array<{ date: string; time: string; seatMapId: string; queueEnabled: boolean; queueLimit: number }>>([
    { date: '', time: '', seatMapId: availableSeatMaps[0].id, queueEnabled: false, queueLimit: 200 },
  ])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingEvent, setIsLoadingEvent] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  function updateShowtime(index: number, patch: Partial<{ date: string; time: string; seatMapId: string; queueEnabled: boolean; queueLimit: number }>) {
    setShowtimes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  function onPosterSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', text: 'Please choose an image file for the poster.' })
      event.target.value = ''
      return
    }
    setPosterPreviewUrl(URL.createObjectURL(file))
  }

  useEffect(() => {
    return () => {
      if (posterPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(posterPreviewUrl)
    }
  }, [posterPreviewUrl])

  useEffect(() => {
    if (!eventId) return
    const targetEventId = eventId
    let isCancelled = false
    async function loadEventForEdit() {
      setIsLoadingEvent(true)
      try {
        const [event, eventShowtimes] = await Promise.all([getEvent(targetEventId), getShowtimesByEvent(targetEventId)])
        if (!event || isCancelled) return
        setEventName(event.name)
        setCategory(event.category)
        setStatus(event.status)
        setCity(event.city)
        setDescription(event.description)
        if (event.imageUrl) setPosterPreviewUrl(event.imageUrl)
        const mappedShowtimes = eventShowtimes
          .map((item) => {
            const start = new Date(item.startTime)
            const date = Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 10)
            const time = Number.isNaN(start.getTime()) ? '' : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
            return {
              date,
              time,
              seatMapId: availableSeatMaps.find((seatMap) => seatMap.label === item.seatMapName)?.id ?? availableSeatMaps[0].id,
              queueEnabled: Boolean(item.queueEnabled),
              queueLimit: item.queueLimit ?? 200,
            }
          })
          .filter((item) => item.date && item.time)
        setShowtimes(mappedShowtimes.length ? mappedShowtimes : [{ date: '', time: '', seatMapId: availableSeatMaps[0].id, queueEnabled: false, queueLimit: 200 }])
      } catch (error) {
        if (!isCancelled) {
          setNotice({ tone: 'error', text: error instanceof Error ? error.message : 'Could not load event to edit.' })
        }
      } finally {
        if (!isCancelled) setIsLoadingEvent(false)
      }
    }
    loadEventForEdit()
    return () => {
      isCancelled = true
    }
  }, [eventId])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const primaryShowtime = showtimes[0]
    if (!primaryShowtime || !primaryShowtime.date || !primaryShowtime.time) {
      setNotice({ tone: 'error', text: 'Please complete at least one showtime with date and time.' })
      return
    }
    if (showtimes.some((item) => item.queueEnabled && (item.queueLimit < 50 || item.queueLimit > 10000))) {
      setNotice({ tone: 'error', text: 'Queue limit per showtime must be between 50 and 10000.' })
      return
    }
    setIsSubmitting(true)
    setNotice(null)
    try {
      const payload: Parameters<typeof createEvent>[0] = {
        kind: 'EVENT',
        name: eventName.trim(),
        category,
        status,
        date: primaryShowtime.date,
        time: primaryShowtime.time,
        venue: availableSeatMaps.find((item) => item.id === primaryShowtime.seatMapId)?.venue ?? city.trim(),
        city: city.trim(),
        address: availableSeatMaps.find((item) => item.id === primaryShowtime.seatMapId)?.address ?? city.trim(),
        description: description.trim(),
        imageUrl: undefined,
        isFlashSale: status === 'Flash Sale',
        showtimes: showtimes
          .filter((showtime) => showtime.date && showtime.time)
          .map((showtime) => ({
            date: showtime.date,
            time: showtime.time,
            seatMapName: availableSeatMaps.find((item) => item.id === showtime.seatMapId)?.label ?? 'Auto map',
            venue: availableSeatMaps.find((item) => item.id === showtime.seatMapId)?.venue ?? city.trim(),
            address: availableSeatMaps.find((item) => item.id === showtime.seatMapId)?.address ?? city.trim(),
            queueEnabled: showtime.queueEnabled,
            queueLimit: showtime.queueEnabled ? showtime.queueLimit : undefined,
          })),
        sections: [{ name: 'Default', rowCount: 10, seatsPerRow: 12, seatClass: 'STANDARD', price: 120000 }],
      }
      if (isEditMode && eventId) {
        await updateEvent(eventId, payload)
        setNotice({ tone: 'success', text: 'Event updated successfully.' })
      } else {
        await createEvent(payload)
        setNotice({ tone: 'success', text: 'Event created successfully via backend API.' })
      }
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : isEditMode ? 'Failed to update event via API.' : 'Failed to create event via API.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className="create-event-page" aria-labelledby="create-event-title">
      <div className="admin-hero create-hero">
        <div>
          <p className="eyebrow">
            <Plus size={18} strokeWidth={2.5} />
            {isEditMode ? 'Edit event' : 'Create event'}
          </p>
          <h1 id="create-event-title">{isEditMode ? 'Refine event details and schedule.' : 'Build the next ticket drop.'}</h1>
        </div>
        <Link className="secondary-button compact-link" to="/admin">
          <ArrowLeft size={18} strokeWidth={2.5} />
          Back to dashboard
        </Link>
      </div>

      <form className="create-event-layout" onSubmit={onSubmit}>
        {isLoadingEvent && <div className="auth-notice info"><p>Loading event details...</p></div>}
        <section className="admin-panel create-main-panel" aria-labelledby="event-basic-title">
          <div className="panel-heading">
            <div>
              <h2 id="event-basic-title">Event details</h2>
              <p>Core listing information customers will see.</p>
            </div>
          </div>

          <div className="poster-uploader">
            <input id="poster-upload" type="file" accept="image/*" onChange={onPosterSelected} />
            <label htmlFor="poster-upload">
              {posterPreviewUrl ? (
                <img src={posterPreviewUrl} alt="Poster preview" className="poster-preview-image" />
              ) : (
                <>
                  <ImagePlus size={34} strokeWidth={2.5} />
                  <span>Choose poster image</span>
                  <small>PNG, JPG, or WebP. Recommended 4:5 poster ratio.</small>
                </>
              )}
            </label>
          </div>

          <div className="create-form-grid">
            <label className="field span-2">
              <span>Event name</span>
              <input type="text" placeholder="Neon Sunset Live" value={eventName} onChange={(event) => setEventName(event.target.value)} required />
            </label>

            <label className="field">
              <span>Category</span>
              <FilterSelect
                value={category}
                valueLabel={category}
                ariaLabel="Select category"
                options={['Music', 'Sports', 'Theater', 'Festival', 'Workshop', 'Comedy'].map((item) => ({ value: item, label: item }))}
                onChange={(value) => setCategory(value as EventCategory)}
              />
            </label>

            <label className="field">
              <span>Status</span>
              <FilterSelect
                value={status}
                valueLabel={status}
                ariaLabel="Select status"
                options={['Available', 'Flash Sale', 'Almost Sold Out', 'Sold Out'].map((item) => ({ value: item, label: item }))}
                onChange={(value) => setStatus(value as TicketStatus)}
              />
            </label>

            <label className="field">
              <span>City</span>
              <input type="text" value={city} onChange={(event) => setCity(event.target.value)} required />
            </label>

            <label className="field span-2">
              <span>Description</span>
              <textarea
                placeholder="Describe the event experience, lineup, entry policy, and highlights."
                rows={5}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <section className="field span-2">
              <span>Showtimes</span>
              <div className="showtime-admin-list redesigned-showtime-list">
                {showtimes.map((showtime, index) => (
                  <article className="showtime-admin-row redesigned-showtime-row" key={`showtime-${index}`}>
                    <div className="showtime-row-title">
                      <strong>Showtime {index + 1}</strong>
                    </div>
                    <label className="field">
                      <span>Date</span>
                      <DatePickerCalendar
                        value={showtime.date}
                        valueLabel={showtime.date || 'Select date'}
                        ariaLabel={`Pick showtime ${index + 1} date`}
                        onChange={(value) => updateShowtime(index, { date: value })}
                      />
                    </label>
                    <label className="field">
                      <span>Time</span>
                      <div className="input-shell icon-field">
                        <Clock size={20} strokeWidth={2.5} aria-hidden="true" />
                        <input type="time" value={showtime.time} onChange={(event) => updateShowtime(index, { time: event.target.value })} required={index === 0} />
                      </div>
                    </label>
                    <label className="field">
                      <span>Seat map</span>
                      <FilterSelect
                        value={showtime.seatMapId}
                        valueLabel={availableSeatMaps.find((item) => item.id === showtime.seatMapId)?.label ?? 'Select map'}
                        ariaLabel={`Select seat map for showtime ${index + 1}`}
                        options={availableSeatMaps.map((item) => ({ value: item.id, label: item.label }))}
                        onChange={(value) => updateShowtime(index, { seatMapId: value })}
                      />
                    </label>
                    <div className="queue-inline-wrapper">
                      <span className="queue-label">Queue</span>
                      <button
                        className={`queue-circular-toggle ${showtime.queueEnabled ? 'active' : ''}`}
                        type="button"
                        onClick={() => updateShowtime(index, { queueEnabled: !showtime.queueEnabled })}
                        aria-label="Toggle Queue"
                      >
                        <span className="toggle-thumb" />
                      </button>
                      <input
                        className="queue-limit-input"
                        type="number"
                        min={50}
                        max={10000}
                        value={showtime.queueLimit}
                        disabled={!showtime.queueEnabled}
                        onChange={(event) => updateShowtime(index, { queueLimit: Number(event.target.value) || 50 })}
                      />
                    </div>
                    <button
                      className="secondary-button"
                      type="button"
                      onClick={() => setShowtimes((current) => (current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index)))}
                      disabled={showtimes.length === 1}
                    >
                      <Trash2 size={18} strokeWidth={2.5} />
                      Remove
                    </button>
                  </article>
                ))}
                <button
                  className="secondary-button add-section-button"
                  type="button"
                  onClick={() => setShowtimes((current) => [...current, { date: '', time: '', seatMapId: availableSeatMaps[0].id, queueEnabled: false, queueLimit: 200 }])}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add showtime
                </button>
              </div>
            </section>
          </div>
        </section>

        <div className="create-actions">
          {notice && (
            <div className={`auth-notice ${notice.tone}`} role="status" aria-live="polite">
              <span className="auth-notice-icon">
                {notice.tone === 'success' ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <AlertCircle size={18} strokeWidth={2.5} />}
              </span>
              <p>{notice.text}</p>
            </div>
          )}
          <button className="secondary-button" type="button">
            Save draft
          </button>
          <button className="primary-button compact-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? (isEditMode ? 'Saving...' : 'Publishing...') : isEditMode ? 'Save changes' : 'Publish event'}
            <span>
              <Save size={18} strokeWidth={2.5} />
            </span>
          </button>
        </div>
      </form>
    </section>
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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false)
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
      <button className="filter-select-trigger" type="button" aria-haspopup="listbox" aria-expanded={isOpen} aria-label={ariaLabel} onClick={() => setIsOpen((open) => !open)}>
        <span>{valueLabel || placeholder}</span>
        <ChevronDown size={18} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="filter-select-menu" role="listbox" aria-label={ariaLabel}>
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

function DatePickerCalendar({
  value,
  valueLabel,
  ariaLabel,
  onChange,
}: {
  value: string
  valueLabel: string
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false)
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

  const days = useMemo(() => {
    const firstVisible = startOfWeek(visibleMonth)
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(firstVisible)
      day.setDate(firstVisible.getDate() + index)
      return day
    })
  }, [visibleMonth])

  return (
    <div className={isOpen ? 'filter-select calendar-filter open' : 'filter-select calendar-filter'} ref={wrapperRef}>
      <button className="filter-select-trigger" type="button" aria-haspopup="dialog" aria-expanded={isOpen} aria-label={ariaLabel} onClick={() => setIsOpen((open) => !open)}>
        <span>{valueLabel}</span>
        <ChevronDown size={18} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="calendar-menu" role="dialog" aria-label={ariaLabel}>
          <div className="calendar-header">
            <button className="tiny-calendar-nav" type="button" onClick={() => setVisibleMonth((month) => addMonths(month, -1))} aria-label="Previous month">
              <ChevronLeft size={16} strokeWidth={2.5} />
            </button>
            <strong>{formatMonthYear(visibleMonth)}</strong>
            <button className="tiny-calendar-nav" type="button" onClick={() => setVisibleMonth((month) => addMonths(month, 1))} aria-label="Next month">
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
              const isActive = value === isoValue
              const isToday = isoValue === toISODate(new Date())
              return (
                <button
                  className={['calendar-day', inMonth ? '' : 'outside', 'available', isActive ? 'active' : '', isToday ? 'today' : ''].filter(Boolean).join(' ')}
                  key={isoValue}
                  type="button"
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
            Clear date
          </button>
        </div>
      )}
    </div>
  )
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
