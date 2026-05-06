import { generateSeats } from '../data/demoTicketRush'
import type {
  Booking,
  DashboardMetrics,
  EventCategory,
  EventItem,
  EventKind,
  MovieMetadata,
  NotificationItem,
  QueueSession,
  Seat,
  SeatSectionInput,
  Showtime,
  SoundSearchLog,
  SoundSearchResult,
  Soundtrack,
  Ticket,
  TicketRushEvent,
  TicketRushState,
  TicketStatus,
} from '../types'

const STORAGE_KEY = 'ticketrush.mock.state.v2'
const HOLD_DURATION_MS = 10 * 60 * 1000
const DEFAULT_USER_ID = 'demo-customer'
const DEFAULT_EVENT_API_URL = '/event-api/api/v1'
let catalogBootstrapPromise: Promise<void> | null = null
function createEmptyState(): TicketRushState {
  return {
    events: [],
    showtimes: [],
    seats: [],
    bookings: [],
    tickets: [],
    queues: [],
    notifications: [],
    soundSearchLogs: [],
  }
}


type EventApiResponse = {
  id: string
  name: string
  description: string
  duration_minutes: number
  event_type: 'EVENT' | 'MOVIE'
  category?: string | null
  venue?: string | null
  city?: string | null
  address?: string | null
  organizer?: string | null
  image_url?: string | null
  sale_opens_at?: string | null
  is_flash_sale?: boolean
  status?: string | null
  director?: string | null
  age_rating?: string | null
  release_date?: string | null
  language?: string | null
}

type ShowtimeApiResponse = {
  id: string
  event_id: string
  venue: string
  address: string
  start_time: string
  end_time: string
  seat_map_name: string
}

export type EventListFilters = {
  kind?: EventKind | 'ALL'
  status?: TicketStatus | 'ALL'
  query?: string
}

export type CreateEventPayload = {
  kind: EventKind
  name: string
  category: EventCategory
  status: TicketStatus
  date: string
  time: string
  venue: string
  city: string
  address: string
  description: string
  imageUrl?: string
  isFlashSale: boolean
  queueEnabled?: boolean
  queueLimit?: number
  showtimes?: Array<{
    date: string
    time: string
    seatMapName: string
    venue: string
    address: string
    queueEnabled?: boolean
    queueLimit?: number
  }>
  sections: SeatSectionInput[]
  cinemaName?: string
  screenName?: string
  format?: string
  movie?: MovieMetadata
  soundtracks?: Array<Omit<Soundtrack, 'id' | 'movieEventId'>>
}

type CreateEventApiRequest = {
  name: string
  description: string
  duration_minutes: number
  event_type: EventKind
  category?: string
  venue?: string
  city?: string
  address?: string
  organizer?: string
  image_url?: string
  sale_opens_at?: string
  is_flash_sale?: boolean
  status?: string
  director?: string
  age_rating?: string
  release_date?: string
  language?: string
}

type ReplaceShowtimesApiRequest = Array<{
  venue: string
  address: string
  start_time: string
  end_time: string
  seat_map_name: string
}>

type SeatStatusResponse = {
  showtimeId: string
  seats: Seat[]
  total: number
  available: number
  holding: number
  sold: number
}

type BookingDetail = {
  booking: Booking
  event: TicketRushEvent
  showtime: Showtime
  seats: Seat[]
  tickets: Ticket[]
}

function delay(ms = 220): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function createId(prefix: string): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2)
  return `${prefix}-${random}`
}

function readState(): TicketRushState {
  if (typeof window === 'undefined') return createEmptyState()

  const raw = window.localStorage.getItem(STORAGE_KEY)
  if (!raw) throw new Error('TicketRush state is not initialized from backend catalog.')

  try {
    return JSON.parse(raw) as TicketRushState
  } catch {
    throw new Error('TicketRush state is corrupted. Reload data from backend.')
  }
}

function writeState(state: TicketRushState): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

function getEventApiBaseUrl(): string {
  const fromEnv = (import.meta as any).env?.VITE_EVENT_API_URL as string | undefined
  return fromEnv?.trim() ? fromEnv.trim().replace(/\/$/, '') : DEFAULT_EVENT_API_URL
}

async function fetchEventApi<T>(path: string): Promise<T> {
  const response = await fetch(`${getEventApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: { accept: 'application/json' },
  })
  if (!response.ok) throw new Error('Unable to fetch event catalog from backend.')
  const payload = (await response.json()) as { data: T }
  return payload.data
}

async function postEventApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getEventApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error('Unable to create event from admin panel.')
  }
  const payload = (await response.json()) as { data: T }
  return payload.data
}

async function putEventApi<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${getEventApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error('Unable to update event from admin panel.')
  }
  const payload = (await response.json()) as { data: T }
  return payload.data
}

async function putEventApiNoResponse(path: string, body: unknown): Promise<void> {
  const response = await fetch(`${getEventApiBaseUrl()}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error('Unable to update showtimes from admin panel.')
  }
}

function normalizeMovieMetadata(event: EventApiResponse): MovieMetadata | undefined {
  if (event.event_type !== 'MOVIE') return undefined
  return {
    director: event.director ?? 'Unknown',
    cast: ['TBA'],
    durationMinutes: event.duration_minutes,
    ageRating: event.age_rating ?? 'K',
    trailerUrl: '',
    genres: [event.category ?? 'Cinema'],
    synopsis: event.description || 'No synopsis available.',
  }
}

function buildFallbackSections(eventKind: EventKind): SeatSectionInput[] {
  if (eventKind === 'MOVIE') {
    return [
      { name: 'Front', rowCount: 2, seatsPerRow: 10, seatClass: 'STANDARD', price: 120000 },
      { name: 'Center', rowCount: 3, seatsPerRow: 10, seatClass: 'VIP', price: 180000 },
      { name: 'Back', rowCount: 3, seatsPerRow: 10, seatClass: 'PREMIUM', price: 260000 },
    ]
  }
  return [
    { name: 'Floor', rowCount: 4, seatsPerRow: 12, seatClass: 'STANDARD', price: 150000 },
    { name: 'Middle', rowCount: 3, seatsPerRow: 12, seatClass: 'VIP', price: 240000 },
    { name: 'Premium', rowCount: 2, seatsPerRow: 12, seatClass: 'PREMIUM', price: 320000 },
  ]
}

async function seedCatalogFromBackend(): Promise<void> {
  const apiEvents = await fetchEventApi<EventApiResponse[]>('/events?page=1&page_size=40')
  if (!apiEvents.length) throw new Error('No events returned from backend catalog.')

  const state = createEmptyState()
  const events: TicketRushEvent[] = []
  const showtimes: Showtime[] = []
  const seats: Seat[] = []

  for (const item of apiEvents) {
    const apiShowtimes = await fetchEventApi<ShowtimeApiResponse[]>(`/events/${item.id}/showtimes`)
    if (!apiShowtimes.length) continue

    const primaryShowtime = apiShowtimes[0]
    const start = new Date(primaryShowtime.start_time)
    const date = start.toISOString().slice(0, 10)
    const time = `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}`
    const kind = item.event_type
    const sections = buildFallbackSections(kind)

    const event: TicketRushEvent = {
      id: item.id,
      kind,
      showtimeId: primaryShowtime.id,
      name: item.name,
      category: (kind === 'MOVIE' ? 'Cinema' : (item.category as EventCategory | undefined)) ?? 'Festival',
      date,
      time,
      venue: item.venue ?? primaryShowtime.venue,
      city: item.city ?? 'Ho Chi Minh City',
      address: item.address ?? primaryShowtime.address,
      organizer: item.organizer ?? (kind === 'MOVIE' ? 'TicketRush Cinema' : 'TicketRush'),
      priceFrom: sections[0].price,
      imageUrl:
        item.image_url ??
        'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1000&q=80',
      status: (item.status as TicketStatus | undefined) ?? (item.is_flash_sale ? 'Flash Sale' : 'Available'),
      capacity: sections.reduce((sum, section) => sum + section.rowCount * section.seatsPerRow, 0),
      sold: 0,
      tags: [kind === 'MOVIE' ? 'movie' : 'event', (item.category ?? 'live').toLowerCase()],
      description: item.description || 'No description provided.',
      saleOpensAt: item.sale_opens_at ?? new Date().toISOString(),
      isFlashSale: Boolean(item.is_flash_sale),
      movie: normalizeMovieMetadata(item),
      soundtracks: kind === 'MOVIE' ? [] : undefined,
    }
    events.push(event)

    for (const apiShowtime of apiShowtimes) {
      showtimes.push({
        id: apiShowtime.id,
        eventId: item.id,
        venue: apiShowtime.venue,
        address: apiShowtime.address,
        startTime: apiShowtime.start_time,
        endTime: apiShowtime.end_time,
        seatMapName: apiShowtime.seat_map_name,
        queueEnabled: Boolean(item.is_flash_sale),
        queueLimit: Boolean(item.is_flash_sale) ? 1000 : undefined,
        cinemaName: kind === 'MOVIE' ? apiShowtime.venue : undefined,
        screenName: kind === 'MOVIE' ? 'Screen 1' : undefined,
        format: kind === 'MOVIE' ? '2D' : undefined,
      })
      seats.push(...generateSeats(apiShowtime.id, sections))
    }
  }

  if (!events.length) throw new Error('Backend returned empty catalog after normalization.')
  writeState({
    ...state,
    events,
    showtimes,
    seats,
  })
}

async function ensureCatalogBootstrap() {
  if (!catalogBootstrapPromise) {
    catalogBootstrapPromise = seedCatalogFromBackend()
  }
  await catalogBootstrapPromise
}

function releaseExpiredHolds(state: TicketRushState): TicketRushState {
  const now = new Date().getTime()
  const expiredBookingIds = new Set(
    state.bookings
      .filter((booking) => booking.status === 'HOLDING' && booking.expiresAt && new Date(booking.expiresAt).getTime() <= now)
      .map((booking) => booking.id),
  )

  if (expiredBookingIds.size === 0) return state

  const nextState = {
    ...state,
    bookings: state.bookings.map((booking) =>
      expiredBookingIds.has(booking.id) ? { ...booking, status: 'EXPIRED' as const, expiresAt: undefined } : booking,
    ),
    seats: state.seats.map((seat) =>
      seat.bookingId && expiredBookingIds.has(seat.bookingId)
        ? { ...seat, status: 'AVAILABLE' as const, bookingId: undefined, expiresAt: undefined }
        : seat,
    ),
  }
  writeState(nextState)
  return nextState
}

function getFreshState(): TicketRushState {
  return releaseExpiredHolds(readState())
}

function seatCounts(state: TicketRushState, showtimeId: string) {
  const seats = state.seats.filter((seat) => seat.showtimeId === showtimeId)
  const sold = seats.filter((seat) => seat.status === 'SOLD').length
  const holding = seats.filter((seat) => seat.status === 'HOLDING').length
  const available = seats.filter((seat) => seat.status === 'AVAILABLE').length
  const priceFrom = Math.min(...seats.map((seat) => seat.price))

  return {
    total: seats.length,
    sold,
    holding,
    available,
    priceFrom: Number.isFinite(priceFrom) ? priceFrom : 0,
  }
}

function deriveStatus(event: TicketRushEvent, sold: number, total: number): TicketStatus {
  if (sold >= total) return 'Sold Out'
  const ratio = total === 0 ? 0 : sold / total
  if (event.isFlashSale && ratio < 0.96) return 'Flash Sale'
  if (ratio >= 0.75) return 'Almost Sold Out'
  return 'Available'
}

function enrichEvent(state: TicketRushState, event: TicketRushEvent): TicketRushEvent {
  const counts = seatCounts(state, event.showtimeId)
  return {
    ...event,
    capacity: counts.total,
    sold: counts.sold,
    priceFrom: counts.priceFrom,
    status: deriveStatus(event, counts.sold, counts.total),
  }
}

function toEventItem(event: TicketRushEvent): EventItem {
  return {
    id: event.id,
    kind: event.kind,
    showtimeId: event.showtimeId,
    name: event.name,
    category: event.category,
    date: event.date,
    time: event.time,
    venue: event.venue,
    city: event.city,
    priceFrom: event.priceFrom,
    imageUrl: event.imageUrl,
    status: event.status,
    capacity: event.capacity,
    sold: event.sold,
    tags: event.tags,
    description: event.description,
    isFlashSale: event.isFlashSale,
    movie: event.movie,
    soundtracks: event.soundtracks,
  }
}

function getBookingDetailFromState(state: TicketRushState, bookingId: string): BookingDetail | undefined {
  const booking = state.bookings.find((item) => item.id === bookingId)
  if (!booking) return undefined

  const event = state.events.find((item) => item.id === booking.eventId)
  const showtime = state.showtimes.find((item) => item.id === booking.showtimeId)
  if (!event || !showtime) return undefined

  const seats = state.seats.filter((seat) => booking.seatIds.includes(seat.id))
  const tickets = state.tickets.filter((ticket) => ticket.bookingId === bookingId)
  return { booking, event: enrichEvent(state, event), showtime, seats, tickets }
}

function revenueForEvent(state: TicketRushState, event: TicketRushEvent): number {
  return state.seats
    .filter((seat) => seat.showtimeId === event.showtimeId && seat.status === 'SOLD')
    .reduce((sum, seat) => sum + seat.price, 0)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(date: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
  }).format(new Date(`${date}T00:00:00`))
}

export async function listEvents(filters: EventListFilters = {}): Promise<EventItem[]> {
  await ensureCatalogBootstrap()
  await delay()
  const state = getFreshState()
  const normalizedQuery = filters.query?.trim().toLowerCase() ?? ''
  const events = state.events.map((event) => toEventItem(enrichEvent(state, event)))

  return events.filter((event) => {
    const matchesKind = !filters.kind || filters.kind === 'ALL' || event.kind === filters.kind
    const matchesStatus = !filters.status || filters.status === 'ALL' || event.status === filters.status
    const searchable = [event.name, event.category, event.kind, event.city, event.venue, event.date, ...event.tags, ...(event.movie?.genres ?? [])]
      .join(' ')
      .toLowerCase()
    const matchesQuery = !normalizedQuery || searchable.includes(normalizedQuery)
    return matchesKind && matchesStatus && matchesQuery
  })
}

export async function getEvent(eventId: string): Promise<TicketRushEvent | undefined> {
  await ensureCatalogBootstrap()
  await delay()
  const state = getFreshState()
  const event = state.events.find((item) => item.id === eventId)
  return event ? enrichEvent(state, event) : undefined
}

export async function getShowtime(showtimeId: string): Promise<Showtime | undefined> {
  await ensureCatalogBootstrap()
  await delay()
  const state = getFreshState()
  return state.showtimes.find((item) => item.id === showtimeId)
}

export async function getShowtimesByEvent(eventId: string): Promise<Showtime[]> {
  await ensureCatalogBootstrap()
  await delay()
  const state = getFreshState()
  return state.showtimes.filter((showtime) => showtime.eventId === eventId)
}

export async function getSeatsStatus(showtimeId: string): Promise<SeatStatusResponse> {
  await ensureCatalogBootstrap()
  await delay(150)
  const state = getFreshState()
  const seats = state.seats
    .filter((seat) => seat.showtimeId === showtimeId)
    .sort((first, second) => first.row.localeCompare(second.row) || first.number - second.number)
  const counts = seatCounts(state, showtimeId)

  return {
    showtimeId,
    seats,
    total: counts.total,
    available: counts.available,
    holding: counts.holding,
    sold: counts.sold,
  }
}

export async function holdSeats(showtimeId: string, seatIds: string[], userId = DEFAULT_USER_ID): Promise<Booking> {
  await ensureCatalogBootstrap()
  await delay(260)
  const state = getFreshState()
  const seats = state.seats.filter((seat) => seat.showtimeId === showtimeId && seatIds.includes(seat.id))

  if (seatIds.length === 0) throw new Error('Select at least one seat.')
  if (seats.length !== seatIds.length || seats.some((seat) => seat.status !== 'AVAILABLE')) {
    throw new Error('One or more seats were just held by another buyer. Please choose again.')
  }

  const showtime = state.showtimes.find((item) => item.id === showtimeId)
  if (!showtime) throw new Error('Showtime was not found.')

  const expiresAt = new Date(new Date().getTime() + HOLD_DURATION_MS).toISOString()
  const booking: Booking = {
    id: createId('booking'),
    userId,
    showtimeId,
    eventId: showtime.eventId,
    seatIds,
    status: 'HOLDING',
    totalAmount: seats.reduce((sum, seat) => sum + seat.price, 0),
    expiresAt,
    createdAt: new Date().toISOString(),
  }

  const nextState: TicketRushState = {
    ...state,
    bookings: [booking, ...state.bookings],
    seats: state.seats.map((seat) =>
      seatIds.includes(seat.id) ? { ...seat, status: 'HOLDING', bookingId: booking.id, expiresAt } : seat,
    ),
  }

  writeState(nextState)
  return booking
}

export async function getBookingDetail(bookingId: string): Promise<BookingDetail | undefined> {
  await ensureCatalogBootstrap()
  await delay(160)
  const state = getFreshState()
  return getBookingDetailFromState(state, bookingId)
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await ensureCatalogBootstrap()
  await delay(180)
  const state = getFreshState()
  writeState({
    ...state,
    bookings: state.bookings.map((booking) =>
      booking.id === bookingId && booking.status === 'HOLDING' ? { ...booking, status: 'CANCELED', expiresAt: undefined } : booking,
    ),
    seats: state.seats.map((seat) =>
      seat.bookingId === bookingId && seat.status === 'HOLDING'
        ? { ...seat, status: 'AVAILABLE', bookingId: undefined, expiresAt: undefined }
        : seat,
    ),
  })
}

export async function confirmBooking(bookingId: string): Promise<BookingDetail> {
  await ensureCatalogBootstrap()
  await delay(320)
  const state = getFreshState()
  const detail = getBookingDetailFromState(state, bookingId)
  if (!detail) throw new Error('Booking was not found.')
  if (detail.booking.status !== 'HOLDING') throw new Error('This booking is no longer waiting for checkout.')

  const now = new Date().toISOString()
  const tickets: Ticket[] = detail.seats.map((seat, index) => {
    const ticketCode = `TR-${bookingId.slice(-6).toUpperCase()}-${index + 1}`
    return {
      id: createId('ticket'),
      bookingId,
      showtimeId: detail.booking.showtimeId,
      eventId: detail.booking.eventId,
      seatId: seat.id,
      ticketCode,
      qrPayload: JSON.stringify({
        ticketCode,
        bookingId,
        event: detail.event.name,
        seat: `${seat.row}${seat.number}`,
        kind: detail.event.kind,
      }),
      issuedAt: now,
    }
  })

  const nextState: TicketRushState = {
    ...state,
    bookings: state.bookings.map((booking) => (booking.id === bookingId ? { ...booking, status: 'PAID', expiresAt: undefined } : booking)),
    seats: state.seats.map((seat) => (seat.bookingId === bookingId ? { ...seat, status: 'SOLD', expiresAt: undefined } : seat)),
    tickets: [...tickets, ...state.tickets.filter((ticket) => ticket.bookingId !== bookingId)],
    notifications: [
      {
        id: createId('notice'),
        userId: detail.booking.userId,
        title: 'Tickets issued',
        message: `${tickets.length} QR ticket${tickets.length > 1 ? 's' : ''} for ${detail.event.name} are ready.`,
        tone: 'SUCCESS',
        read: false,
        createdAt: now,
        link: '/tickets',
      },
      ...state.notifications,
    ],
  }

  writeState(nextState)
  const confirmed = getBookingDetailFromState(nextState, bookingId)
  if (!confirmed) throw new Error('Could not issue e-tickets.')
  return confirmed
}

export async function listTickets(): Promise<BookingDetail[]> {
  await ensureCatalogBootstrap()
  await delay(180)
  const state = getFreshState()
  return state.bookings
    .filter((booking) => booking.status === 'PAID')
    .map((booking) => getBookingDetailFromState(state, booking.id))
    .filter((detail): detail is BookingDetail => Boolean(detail))
}

export async function joinQueue(showtimeId: string): Promise<QueueSession> {
  await ensureCatalogBootstrap()
  await delay(180)
  const state = getFreshState()
  const existing = state.queues.find((queue) => queue.showtimeId === showtimeId && !queue.accessGranted)
  if (existing) return existing

  const session: QueueSession = {
    token: createId('queue'),
    showtimeId,
    position: 90 + Math.floor(Math.random() * 80),
    batchSize: 50,
    accessGranted: false,
    createdAt: new Date().toISOString(),
  }

  writeState({ ...state, queues: [session, ...state.queues] })
  return session
}

export async function getQueueStatus(token: string): Promise<QueueSession | undefined> {
  await ensureCatalogBootstrap()
  await delay(120)
  const state = getFreshState()
  const queue = state.queues.find((item) => item.token === token)
  if (!queue) return undefined

  const nextPosition = Math.max(0, queue.position - (9 + Math.floor(Math.random() * 18)))
  const nextQueue: QueueSession =
    nextPosition <= queue.batchSize
      ? { ...queue, position: 0, accessGranted: true, accessToken: queue.accessToken ?? createId('access') }
      : { ...queue, position: nextPosition }

  writeState({
    ...state,
    queues: state.queues.map((item) => (item.token === token ? nextQueue : item)),
  })
  return nextQueue
}

export async function createEvent(payload: CreateEventPayload): Promise<TicketRushEvent> {
  const apiPayload: CreateEventApiRequest = {
    name: payload.name,
    description: payload.description,
    duration_minutes:
      payload.kind === 'MOVIE'
        ? payload.movie?.durationMinutes ?? 120
        : Math.max(60, Math.min(360, Math.round((payload.sections.length || 2) * 60))),
    event_type: payload.kind,
    category: payload.kind === 'MOVIE' ? 'Cinema' : payload.category,
    venue: payload.venue,
    city: payload.city,
    address: payload.address,
    organizer: payload.kind === 'MOVIE' ? 'TicketRush Cinema' : 'TicketRush Admin',
    image_url: payload.imageUrl,
    sale_opens_at: new Date().toISOString(),
    is_flash_sale: payload.isFlashSale,
    status: payload.status,
    director: payload.kind === 'MOVIE' ? payload.movie?.director : undefined,
    age_rating: payload.kind === 'MOVIE' ? payload.movie?.ageRating : undefined,
    release_date: payload.kind === 'MOVIE' ? `${payload.date}T00:00:00Z` : undefined,
    language: payload.kind === 'MOVIE' ? 'Vietnamese' : undefined,
  }
  const created = await postEventApi<EventApiResponse>('/events', apiPayload)
  if (payload.showtimes?.length) {
    const showtimePayload: ReplaceShowtimesApiRequest = payload.showtimes.map((showtime, index) => {
      const start = new Date(`${showtime.date}T${showtime.time}:00`)
      const end = new Date(start.getTime() + 120 * 60 * 1000)
      return {
        venue: showtime.venue,
        address: showtime.address,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        seat_map_name: showtime.seatMapName || `Auto map ${index + 1}`,
      }
    })
    await putEventApiNoResponse(`/events/${encodeURIComponent(created.id)}/showtimes`, showtimePayload)
  }
  catalogBootstrapPromise = null
  resetDemoState()
  await ensureCatalogBootstrap()
  const state = getFreshState()
  const existing = state.events.find((event) => event.id === created.id)
  if (!existing) {
    throw new Error('Event was created but not found in refreshed catalog.')
  }
  return existing
}

export async function updateEvent(eventId: string, payload: CreateEventPayload): Promise<TicketRushEvent> {
  const apiPayload: CreateEventApiRequest = {
    name: payload.name,
    description: payload.description,
    duration_minutes:
      payload.kind === 'MOVIE'
        ? payload.movie?.durationMinutes ?? 120
        : Math.max(60, Math.min(360, Math.round((payload.sections.length || 2) * 60))),
    event_type: payload.kind,
    category: payload.kind === 'MOVIE' ? 'Cinema' : payload.category,
    venue: payload.venue,
    city: payload.city,
    address: payload.address,
    organizer: payload.kind === 'MOVIE' ? 'TicketRush Cinema' : 'TicketRush Admin',
    image_url: payload.imageUrl,
    sale_opens_at: new Date().toISOString(),
    is_flash_sale: payload.isFlashSale,
    status: payload.status,
    director: payload.kind === 'MOVIE' ? payload.movie?.director : undefined,
    age_rating: payload.kind === 'MOVIE' ? payload.movie?.ageRating : undefined,
    release_date: payload.kind === 'MOVIE' ? `${payload.date}T00:00:00Z` : undefined,
    language: payload.kind === 'MOVIE' ? 'Vietnamese' : undefined,
  }
  await putEventApi<EventApiResponse>(`/events/${encodeURIComponent(eventId)}`, apiPayload)
  if (payload.showtimes?.length) {
    const showtimePayload: ReplaceShowtimesApiRequest = payload.showtimes.map((showtime, index) => {
      const start = new Date(`${showtime.date}T${showtime.time}:00`)
      const end = new Date(start.getTime() + 120 * 60 * 1000)
      return {
        venue: showtime.venue,
        address: showtime.address,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        seat_map_name: showtime.seatMapName || `Auto map ${index + 1}`,
      }
    })
    await putEventApiNoResponse(`/events/${encodeURIComponent(eventId)}/showtimes`, showtimePayload)
  }
  catalogBootstrapPromise = null
  resetDemoState()
  await ensureCatalogBootstrap()
  const state = getFreshState()
  const existing = state.events.find((event) => event.id === eventId)
  if (!existing) {
    throw new Error('Event was updated but not found in refreshed catalog.')
  }
  return existing
}

export async function listNotifications(userId = DEFAULT_USER_ID): Promise<NotificationItem[]> {
  await ensureCatalogBootstrap()
  await delay(120)
  const state = getFreshState()
  return state.notifications.filter((notification) => notification.userId === userId).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  await ensureCatalogBootstrap()
  await delay(100)
  const state = getFreshState()
  writeState({
    ...state,
    notifications: state.notifications.map((notification) =>
      notification.id === notificationId ? { ...notification, read: true } : notification,
    ),
  })
}

export async function recognizeHummedSong(audioBlob: Blob): Promise<SoundSearchResult[]> {
  await ensureCatalogBootstrap()
  await delay(1300)
  const state = getFreshState()
  const audioWeight = Math.min(6, Math.floor(audioBlob.size / 10000))
  const movieEvents = state.events.filter((event) => event.kind === 'MOVIE' && event.soundtracks?.length)
  const scored = movieEvents.flatMap((event, eventIndex) =>
    (event.soundtracks ?? []).map((track, trackIndex) => {
      const confidence = Math.max(73, 96 - eventIndex * 5 - trackIndex * 4 + audioWeight)
      return {
        id: createId('sound-result'),
        soundtrack: track,
        event: enrichEvent(state, event),
        nextShowtime: state.showtimes.find((showtime) => showtime.eventId === event.id),
        confidence,
        matchedPhrase: `Melody contour matched ${confidence}% of "${track.title}".`,
      }
    }),
  )

  const results = scored.sort((first, second) => second.confidence - first.confidence).slice(0, 4)
  const top = results[0]

  if (top) {
    const log: SoundSearchLog = {
      id: createId('sound-log'),
      songTitle: top.soundtrack.title,
      movieName: top.event.name,
      confidence: top.confidence,
      conversionStatus: 'Matched',
      createdAt: new Date().toISOString(),
    }
    writeState({ ...state, soundSearchLogs: [log, ...state.soundSearchLogs].slice(0, 12) })
  }

  return results
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  await ensureCatalogBootstrap()
  await delay(180)
  const state = getFreshState()
  const events = state.events.map((event) => enrichEvent(state, event))
  const paidBookings = state.bookings.filter((booking) => booking.status === 'PAID')
  const revenue = paidBookings.reduce((sum, booking) => sum + booking.totalAmount, 0)
  const availableSeats = state.seats.filter((seat) => seat.status === 'AVAILABLE').length
  const holdingSeats = state.seats.filter((seat) => seat.status === 'HOLDING').length
  const soldSeats = state.seats.filter((seat) => seat.status === 'SOLD').length
  const totalSeats = state.seats.length || 1
  const eventRevenue = events.filter((event) => event.kind === 'EVENT').reduce((sum, event) => sum + revenueForEvent(state, event), 0)
  const movieRevenue = events.filter((event) => event.kind === 'MOVIE').reduce((sum, event) => sum + revenueForEvent(state, event), 0)
  const categoryTotals = events.reduce<Record<string, number>>((acc, event) => {
    acc[event.category] = (acc[event.category] ?? 0) + 1
    return acc
  }, {})

  return {
    totalEvents: events.filter((event) => event.kind === 'EVENT').length,
    totalMovies: events.filter((event) => event.kind === 'MOVIE').length,
    ticketsSold: soldSeats,
    revenue,
    eventRevenue,
    movieRevenue,
    customers: 19600 + paidBookings.length,
    fillRate: Math.round((soldSeats / totalSeats) * 100),
    queueLoad: state.queues.filter((queue) => !queue.accessGranted).length * 50 + holdingSeats,
    availableSeats,
    holdingSeats,
    soldSeats,
    revenueSeries: [42, 58, 51, 76, 88, 70, Math.max(34, Math.min(100, Math.round((revenue + 8500000) / 250000)))],
    categoryMix: (Object.entries(categoryTotals) as Array<[EventCategory, number]>).map(([label, value], index) => ({
      label,
      value,
      color: ['var(--primary)', 'var(--secondary)', 'var(--accent)', 'var(--foreground)'][index % 4],
    })),
    ageGroups: [
      { label: '18-24', value: 31 },
      { label: '25-34', value: 42 },
      { label: '35-44', value: 18 },
      { label: '45+', value: 9 },
    ],
    genderMix: [
      { label: 'Women', value: 48, color: 'var(--secondary)' },
      { label: 'Men', value: 45, color: 'var(--primary)' },
      { label: 'Other', value: 7, color: 'var(--accent)' },
    ],
    activeEvents: events.slice(0, 8).map((event) => ({
      id: event.id,
      name: event.name,
      kind: event.kind,
      category: event.category,
      date: event.date,
      status: event.status,
      sold: event.sold,
      capacity: event.capacity,
      revenue: revenueForEvent(state, event),
    })),
    topMovies: events
      .filter((event) => event.kind === 'MOVIE')
      .map((event) => ({
        id: event.id,
        name: event.name,
        sold: event.sold,
        capacity: event.capacity,
        revenue: revenueForEvent(state, event),
      }))
      .sort((first, second) => second.sold - first.sold)
      .slice(0, 5),
    soundtrackInsights: state.soundSearchLogs.slice(0, 8),
  }
}

export function resetDemoState(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(STORAGE_KEY)
  }
  catalogBootstrapPromise = null
}
