import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Film,
  ImagePlus,
  Plus,
  Save,
  Ticket,
  Trash2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { createEvent, fetchSeatMaps, getEvent, getShowtimesByEvent, listEvents, updateEvent } from '../services/ticketRushApi'
import type { EventCategory, EventItem, SeatSectionInput, TicketStatus } from '../types'
import type { EnrichedTmdbMovie } from '../services/tmdbApi'
import { SeatMapDesignerPage, type SavedSeatMap } from './SeatMapDesignerPage'
import { MoviePickerModal } from './MoviePickerModal'

type SeatMapApiSeat = {
  row: string
  number: number
  seat_class: SeatSectionInput['seatClass']
  price: number
}

function buildSectionsFromApiSeats(apiSeats?: SeatMapApiSeat[]): SeatSectionInput[] {
  if (!apiSeats?.length) return []
  const rowGroups = new Map<string, SeatMapApiSeat[]>()
  for (const seat of apiSeats) {
    const seats = rowGroups.get(seat.row) ?? []
    seats.push(seat)
    rowGroups.set(seat.row, seats)
  }

  const rows = [...rowGroups.entries()].sort(([first], [second]) => first.localeCompare(second, undefined, { numeric: true }))
  const sections: SeatSectionInput[] = []
  let current: SeatSectionInput | null = null

  for (const [, seats] of rows) {
    const sortedSeats = [...seats].sort((first, second) => first.number - second.number)
    const firstSeat = sortedSeats[0]
    if (!firstSeat) continue
    const rowSection = {
      name: firstSeat.seat_class.charAt(0) + firstSeat.seat_class.slice(1).toLowerCase(),
      rowCount: 1,
      seatsPerRow: sortedSeats.length,
      seatClass: firstSeat.seat_class,
      price: Number(firstSeat.price),
    }
    if (
      current &&
      current.seatClass === rowSection.seatClass &&
      current.price === rowSection.price &&
      current.seatsPerRow === rowSection.seatsPerRow
    ) {
      current.rowCount += 1
    } else {
      current = rowSection
      sections.push(current)
    }
  }

  return sections
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function normalizeMovieTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type AdminShowtimeRow = {
  id?: string
  date: string
  time: string
  seatMapId: string
  queueEnabled: boolean
  queueLimit: number
  /** Preserves API start/end length when saving (ms). */
  durationMs: number
}

const defaultShowtimeRow = (seatMaps: SavedSeatMap[]): AdminShowtimeRow => ({
  date: '',
  time: '',
  seatMapId: seatMaps[0]?.id ?? 'concert-main',
  queueEnabled: false,
  queueLimit: 200,
  durationMs: 120 * 60 * 1000,
})

export function AdminCreateEventPage({ asModal, onSuccess, onClose }: { asModal?: boolean; onSuccess?: (eventId: string) => void; onClose?: () => void }) {
  const { eventId: paramEventId } = useParams<{ eventId: string }>()
  const location = useLocation()
  const eventId = asModal ? undefined : paramEventId
  const isEditMode = Boolean(eventId)
  const [availableSeatMaps, setAvailableSeatMaps] = useState<SavedSeatMap[]>([])
  const [eventName, setEventName] = useState('')
  const [category, setCategory] = useState<EventCategory>('Music')
  const [status, setStatus] = useState<TicketStatus>('Available')
  const [city, setCity] = useState('Ho Chi Minh City')
  const [description, setDescription] = useState('')
  const [posterPreviewUrl, setPosterPreviewUrl] = useState('')
  const [posterFile, setPosterFile] = useState<File | null>(null)
  const [eventDurationMinutes, setEventDurationMinutes] = useState(120)
  const [showtimes, setShowtimes] = useState<AdminShowtimeRow[]>([defaultShowtimeRow(availableSeatMaps)])
  const [maxTicketsPerBooking, setMaxTicketsPerBooking] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoadingEvent, setIsLoadingEvent] = useState(false)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isCreatingSeatMap, setIsCreatingSeatMap] = useState(false)
  const [isMoviePickerOpen, setIsMoviePickerOpen] = useState(false)
  const [selectedTmdbMovie, setSelectedTmdbMovie] = useState<EnrichedTmdbMovie | null>(null)
  const [duplicateMovieEvent, setDuplicateMovieEvent] = useState<EventItem | null>(null)
  const isMovieCategory = category === 'Cinema'

  // Accept TMDB movie data from navigation state (from AdminMoviesPage)
  useEffect(() => {
    const state = location.state as { tmdbMovie?: EnrichedTmdbMovie } | null
    if (state?.tmdbMovie && !isEditMode) {
      void applyTmdbMovie(state.tmdbMovie)
      // Clear the state so it doesn't re-apply on re-render
      window.history.replaceState({}, document.title)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function findDuplicateMovieEvent(movie: EnrichedTmdbMovie): Promise<EventItem | null> {
    const movieTitle = normalizeMovieTitle(movie.title)
    const originalTitle = normalizeMovieTitle(movie.originalTitle)
    const events = await listEvents({ kind: 'MOVIE' })
    return events.find((event) => {
      const eventTitle = normalizeMovieTitle(event.name)
      return eventTitle === movieTitle || Boolean(originalTitle && eventTitle === originalTitle)
    }) ?? null
  }

  async function applyTmdbMovie(movie: EnrichedTmdbMovie) {
    const duplicate = await findDuplicateMovieEvent(movie).catch(() => null)
    setDuplicateMovieEvent(duplicate)
    setSelectedTmdbMovie(movie)
    setCategory('Cinema')
    setEventName(movie.title)
    setDescription(movie.overview)
    setPosterPreviewUrl(movie.posterUrl)
    setEventDurationMinutes(movie.runtime || 120)
    setCity('Ho Chi Minh City')
    if (duplicate) {
      setNotice({ tone: 'error', text: `Movie "${movie.title}" already has an event. Open "${duplicate.name}" instead of creating a duplicate.` })
    } else {
      setNotice(null)
    }
  }

  function handleMovieSelected(movie: EnrichedTmdbMovie) {
    void applyTmdbMovie(movie)
    setIsMoviePickerOpen(false)
  }

  function handleClearMovie() {
    setSelectedTmdbMovie(null)
    setDuplicateMovieEvent(null)
  }

  function updateShowtime(index: number, patch: Partial<AdminShowtimeRow>) {
    setShowtimes((current) => current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)))
  }

  const refreshSeatMaps = useCallback(() => {
    fetchSeatMaps()
      .then((maps) =>
        setAvailableSeatMaps(
          maps.map((m) => ({
            id: m.id,
            name: m.name,
            venue: m.venue_name,
            address: m.venue_address,
            rows: 0,
            cols: 0,
            sections: buildSectionsFromApiSeats(m.seats),
            seats: [],
          })),
        ),
      )
      .catch(() => { })
  }, [])

  useEffect(() => {
    refreshSeatMaps()
  }, [refreshSeatMaps])

  function onPosterSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', text: 'Please choose an image file for the poster.' })
      event.target.value = ''
      return
    }
    setPosterFile(file)
    setPosterPreviewUrl(URL.createObjectURL(file))
  }

  useEffect(() => {
    return () => {
      if (posterPreviewUrl.startsWith('blob:')) URL.revokeObjectURL(posterPreviewUrl)
    }
  }, [posterPreviewUrl])

  useEffect(() => {
    if (!eventId) return
    if (!availableSeatMaps.length) return
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
        setMaxTicketsPerBooking(
          (event as unknown as { maxTicketsPerBooking?: number | null }).maxTicketsPerBooking
            ? String((event as unknown as { maxTicketsPerBooking?: number | null }).maxTicketsPerBooking)
            : '',
        )
        const durationM =
          event.kind === 'MOVIE' ? (event.movie?.durationMinutes ?? 120) : (event.durationMinutes ?? 120)
        setEventDurationMinutes(durationM)
        const mappedShowtimes = eventShowtimes
          .map((item) => {
            const start = new Date(item.startTime)
            const end = new Date(item.endTime)
            const durationMs = Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())
              ? 120 * 60 * 1000
              : Math.max(60 * 1000, end.getTime() - start.getTime())
            const date = Number.isNaN(start.getTime()) ? '' : start.toISOString().slice(0, 10)
            const time = Number.isNaN(start.getTime()) ? '' : `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
            return {
              id: item.id,
              date,
              time,
              seatMapId: availableSeatMaps.find((seatMap) => seatMap.name === item.seatMapName)?.id ?? availableSeatMaps[0]?.id ?? '',
              queueEnabled: Boolean(item.queueEnabled),
              queueLimit: item.queueLimit ?? 200,
              durationMs,
            }
          })
          .filter((item) => item.date && item.time)
        setShowtimes(mappedShowtimes.length ? mappedShowtimes : [defaultShowtimeRow(availableSeatMaps)])
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
  }, [availableSeatMaps, eventId])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const primaryShowtime = showtimes[0]
    if (!primaryShowtime || !primaryShowtime.date || !primaryShowtime.time) {
      setNotice({ tone: 'error', text: 'Please complete at least one showtime with date and time.' })
      return
    }
    if (showtimes.some((item) => item.queueEnabled && (item.queueLimit <= 0 || item.queueLimit > 10000))) {
      setNotice({ tone: 'error', text: 'Queue limit per showtime must be greater than 0 and up to 10000.' })
      return
    }
    if (!isEditMode && selectedTmdbMovie) {
      const duplicate = duplicateMovieEvent ?? await findDuplicateMovieEvent(selectedTmdbMovie).catch(() => null)
      if (duplicate) {
        setDuplicateMovieEvent(duplicate)
        setNotice({ tone: 'error', text: `Movie "${selectedTmdbMovie.title}" already has an event. Open "${duplicate.name}" instead of creating a duplicate.` })
        return
      }
    }
    setIsSubmitting(true)
    setNotice(null)
    try {
      // Convert blob file to data URL for API if a file was chosen
      let posterForApi: string | undefined
      if (posterFile) {
        posterForApi = await fileToDataUrl(posterFile)
      } else if (posterPreviewUrl && !posterPreviewUrl.startsWith('blob:')) {
        posterForApi = posterPreviewUrl.trim() || undefined
      }

      const isMovie = isMovieCategory || Boolean(selectedTmdbMovie)
      const primarySeatMap = availableSeatMaps.find((item) => item.id === primaryShowtime.seatMapId)

      const buildSections = (): SeatSectionInput[] => {
        if (primarySeatMap?.sections?.length) {
          return primarySeatMap.sections
        }
        if (isMovie) {
          return [{ name: 'Default', rowCount: 10, seatsPerRow: 12, seatClass: 'STANDARD', price: 120000 }]
        }
        return [{ name: 'Default', rowCount: 10, seatsPerRow: 12, seatClass: 'STANDARD', price: 120000 }]
      }

      const payload: Parameters<typeof createEvent>[0] = {
        kind: isMovie ? 'MOVIE' : 'EVENT',
        name: eventName.trim(),
        category: isMovie ? 'Cinema' : category,
        status,
        date: primaryShowtime.date,
        time: primaryShowtime.time,
        venue: primarySeatMap?.venue || city.trim(),
        city: city.trim(),
        address: primarySeatMap?.address || city.trim(),
        description: description.trim(),
        imageUrl: posterForApi,
        isFlashSale: status === 'Flash Sale',
        ...(isEditMode ? { durationMinutes: eventDurationMinutes } : {}),
        showtimes: showtimes
          .filter((showtime) => showtime.date && showtime.time)
          .map((showtime) => {
            const seatMap = availableSeatMaps.find((item) => item.id === showtime.seatMapId)
            return {
              ...(showtime.id ? { id: showtime.id } : {}),
              date: showtime.date,
              time: showtime.time,
              seatMapName: seatMap?.name ?? 'Auto map',
              venue: seatMap?.venue || city.trim(),
              address: seatMap?.address || city.trim(),
              queueEnabled: showtime.queueEnabled,
              queueLimit: showtime.queueEnabled ? showtime.queueLimit : undefined,
              durationMs: isMovie ? (selectedTmdbMovie?.runtime ?? eventDurationMinutes) * 60 * 1000 : showtime.durationMs,
            }
          }),
        sections: buildSections(),
        maxTicketsPerBooking: maxTicketsPerBooking.trim() ? Number(maxTicketsPerBooking.trim()) : null,
        ...(isMovie && selectedTmdbMovie
          ? {
            movie: {
              director: selectedTmdbMovie.director,
              cast: selectedTmdbMovie.cast,
              durationMinutes: selectedTmdbMovie.runtime,
              ageRating: selectedTmdbMovie.ageRating,
              trailerUrl: selectedTmdbMovie.trailerUrl,
              genres: selectedTmdbMovie.genres,
              synopsis: selectedTmdbMovie.overview,
            },
          }
          : {}),
      }
      if (isEditMode && eventId) {
        await updateEvent(eventId, payload)
        setNotice({ tone: 'success', text: 'Event updated successfully.' })
        if (onSuccess) onSuccess(eventId)
      } else {
        const created = await createEvent(payload)
        setNotice({ tone: 'success', text: isMovie ? 'Movie event created successfully.' : 'Event created successfully via backend API.' })
        if (onSuccess) onSuccess(created.id)
      }
    } catch (error) {
      setNotice({ tone: 'error', text: error instanceof Error ? error.message : isEditMode ? 'Failed to update event via API.' : 'Failed to create event via API.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <section className={asModal ? "modal-body-container" : "create-event-page"} aria-labelledby="create-event-title">
      {!asModal && (
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
      )}

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
              <input type="text" placeholder="Neon Sunset Live" value={eventName} onChange={(event) => setEventName(event.target.value)} required disabled={Boolean(selectedTmdbMovie)} />
            </label>

            <label className="field">
              <span>Category</span>
              <FilterSelect
                value={category}
                valueLabel={category}
                ariaLabel="Select category"
                options={['Music', 'Sports', 'Theater', 'Festival', 'Workshop', 'Comedy', 'Cinema'].map((item) => ({ value: item, label: item }))}
                onChange={(value) => {
                  setCategory(value as EventCategory)
                  if (value !== 'Cinema') {
                    setSelectedTmdbMovie(null)
                    setDuplicateMovieEvent(null)
                  }
                }}
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

            {/* Movie Picker for Cinema category */}
            {isMovieCategory && (
              <div className="field span-2">
                <span>Movie from TMDB</span>
                {selectedTmdbMovie ? (
                  <div className="tmdb-movie-selected">
                    <div className="tmdb-movie-selected-info">
                      {selectedTmdbMovie.posterUrl && (
                        <img
                          className="tmdb-movie-selected-poster"
                          src={selectedTmdbMovie.posterUrl}
                          alt={selectedTmdbMovie.title}
                        />
                      )}
                      <div className="tmdb-movie-selected-details">
                        <h3>{selectedTmdbMovie.title}</h3>
                        <p>{selectedTmdbMovie.director} · {selectedTmdbMovie.runtime} min · {selectedTmdbMovie.releaseDate?.slice(0, 4)}</p>
                        <p className="tmdb-movie-selected-genres">{selectedTmdbMovie.genres.join(', ')}</p>
                        <p className="tmdb-movie-selected-cast">{selectedTmdbMovie.cast.slice(0, 4).join(', ')}</p>
                      </div>
                    </div>
                    <button
                      className="secondary-button compact-button"
                      type="button"
                      onClick={handleClearMovie}
                    >
                      <X size={16} strokeWidth={2.5} />
                      Remove
                    </button>
                    {duplicateMovieEvent && (
                      <div className="auth-notice error" role="alert" style={{ marginTop: 12 }}>
                        <span className="auth-notice-icon">
                          <AlertCircle size={18} strokeWidth={2.5} />
                        </span>
                        <p>Movie event already exists: {duplicateMovieEvent.name}. Duplicate creation is disabled.</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <button
                    className="tmdb-movie-picker-trigger"
                    type="button"
                    onClick={() => setIsMoviePickerOpen(true)}
                  >
                    <div className="tmdb-movie-picker-icon">
                      <Film size={28} strokeWidth={2} />
                    </div>
                    <span>Click to select a movie from TMDB</span>
                  </button>
                )}
              </div>
            )}

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
                disabled={Boolean(selectedTmdbMovie)}
              />
            </label>

            {/* Movie metadata display (disabled fields) when TMDB movie is selected */}
            {selectedTmdbMovie && (
              <>
                <label className="field">
                  <span>Director</span>
                  <input type="text" value={selectedTmdbMovie.director} disabled />
                </label>
                <label className="field">
                  <span>Runtime (min)</span>
                  <input type="text" value={`${selectedTmdbMovie.runtime} minutes`} disabled />
                </label>
                <label className="field">
                  <span>Age Rating</span>
                  <input type="text" value={selectedTmdbMovie.ageRating} disabled />
                </label>
                <label className="field">
                  <span>Language</span>
                  <input type="text" value={selectedTmdbMovie.language} disabled />
                </label>
                <label className="field span-2">
                  <span>Cast</span>
                  <input type="text" value={selectedTmdbMovie.cast.join(', ')} disabled />
                </label>
                <label className="field span-2">
                  <span>Genres</span>
                  <div className="tmdb-genre-chips">
                    {selectedTmdbMovie.genres.map((g) => (
                      <span className="chip" key={g}>{g}</span>
                    ))}
                  </div>
                </label>
              </>
            )}

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
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Seat map</span>
                        <button
                          type="button"
                          onClick={() => setIsCreatingSeatMap(true)}
                          style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 800, textTransform: 'uppercase', padding: 0 }}
                        >
                          + NEW
                        </button>
                      </div>
                      <FilterSelect
                        value={showtime.seatMapId}
                        valueLabel={availableSeatMaps.find((item) => item.id === showtime.seatMapId)?.name ?? 'Select map'}
                        ariaLabel={`Select seat map for showtime ${index + 1}`}
                        options={availableSeatMaps.map((item) => ({ value: item.id, label: item.name }))}
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
                        max={10000}
                        value={showtime.queueLimit}
                        disabled={!showtime.queueEnabled}
                        onChange={(event) => updateShowtime(index, { queueLimit: Number(event.target.value) || 1 })}
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
                  onClick={() => setShowtimes((current) => [...current, defaultShowtimeRow(availableSeatMaps)])}
                >
                  <Plus size={18} strokeWidth={2.5} />
                  Add showtime
                </button>
              </div>
            </section>

            <label className="field span-2">
              <span>Max tickets per booking</span>
              <div className="input-shell icon-field">
                <Ticket size={20} strokeWidth={2.5} aria-hidden="true" />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxTicketsPerBooking}
                  onChange={(event) => setMaxTicketsPerBooking(event.target.value)}
                  placeholder="Unlimited (leave empty for no limit)"
                />
              </div>
              <small style={{ color: 'var(--muted-foreground)', marginTop: 4, display: 'block' }}>
                Limits how many seats a customer can book per showtime. Leave empty for unlimited.
              </small>
            </label>
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
          {asModal && (
            <button className="secondary-button" type="button" onClick={onClose}>
              Cancel
            </button>
          )}
          {!asModal && (
            <button className="secondary-button" type="button">
              Save draft
            </button>
          )}
          <button className="primary-button compact-button" type="submit" disabled={isSubmitting || Boolean(duplicateMovieEvent)}>
            {isSubmitting ? (isEditMode ? 'Saving...' : 'Publishing...') : isEditMode ? 'Save changes' : 'Publish event'}
            <span>
              <Save size={18} strokeWidth={2.5} />
            </span>
          </button>
        </div>
      </form>

      {isCreatingSeatMap && (
        <div className="modal-backdrop blurred" style={{ zIndex: 50 }}>
          <div
            className="ticket-modal"
            style={{ gridTemplateColumns: '1fr', width: 'min(100%, 1200px)', padding: '24px', position: 'relative' }}
          >
            <SeatMapDesignerPage
              asModal
              onClose={() => setIsCreatingSeatMap(false)}
              onSave={(savedMap) => {
                setAvailableSeatMaps((current) => [...current.filter((item) => item.id !== savedMap.id), savedMap])
                refreshSeatMaps()
                if (savedMap) {
                  setShowtimes((current) =>
                    current.map((st, i) => (i === 0 ? { ...st, seatMapId: savedMap.id } : st)),
                  )
                }
                setIsCreatingSeatMap(false)
              }}
            />
          </div>
        </div>
      )}

      {isMoviePickerOpen && (
        <MoviePickerModal
          onSelect={handleMovieSelected}
          onClose={() => setIsMoviePickerOpen(false)}
        />
      )}
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
