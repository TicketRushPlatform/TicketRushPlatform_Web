import { generateSeats } from '../data/demoTicketRush'
import { config } from '../config/env'
import { loadTokens } from './authStorage'
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
  SeatClass,
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
const DEFAULT_USER_ID = 'demo-customer'
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
  creator_id: string
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
  max_tickets_per_booking?: number | null
}

type ShowtimeApiResponse = {
  id: string
  event_id: string
  venue: string
  address: string
  start_time: string
  end_time: string
  seat_map_name: string
  queue_enabled?: boolean
  queue_limit?: number
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
    id?: string
    date: string
    time: string
    seatMapName: string
    venue: string
    address: string
    queueEnabled?: boolean
    queueLimit?: number
    /** If set, end_time = start + durationMs (preserves real slot length on edit). */
    durationMs?: number
  }>
  /** When updating an EVENT from admin, pass API duration so it is not replaced by section heuristics. */
  durationMinutes?: number
  sections: SeatSectionInput[]
  cinemaName?: string
  screenName?: string
  format?: string
  movie?: MovieMetadata
  soundtracks?: Array<Omit<Soundtrack, 'id' | 'movieEventId'>>
  maxTicketsPerBooking?: number | null
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
  max_tickets_per_booking?: number | null
}

type ReplaceShowtimesApiRequest = Array<{
  id?: string
  venue: string
  address: string
  start_time: string
  end_time: string
  seat_map_name: string
  queue_enabled?: boolean
  queue_limit?: number
}>

type SeatStatusResponse = {
  showtimeId: string
  seats: Seat[]
  total: number
  available: number
  holding: number
  sold: number
}

type BookingSeatStatusDTO = {
  seat_id: string
  row: string
  number: number
  seat_class: SeatClass
  status: Seat['status']
  price?: string
  expires_at?: string
}

export type RealtimeSeatStatus = {
  showtimeId: string
  seats: Array<{
    id: string
    row: string
    number: number
    seatClass: SeatClass
    status: Seat['status']
    price?: number
    expiresAt?: string
  }>
  total: number
  available: number
  holding: number
  sold: number
}

type BookingSeatStatusResponse = {
  showtime_id: string
  seats: BookingSeatStatusDTO[]
  total: number
  available: number
  holding: number
  sold: number
}

type SeatStatusSocketMessage = {
  type: 'seat_status'
  data: BookingSeatStatusResponse
}

type ApiEnvelope<T> = {
  data: T
  message?: string
}

type QueueApiResponse = {
  showtime_id: string
  user_id: string
  position: number
  total_waiting: number
  in_queue: boolean
  can_enter: boolean
}

type BookingApiResponse = {
  id: string
  status: Booking['status']
  showtime_id: string
  expires_at?: string
  items: Array<{
    seat_id: string
    row: string
    number: number
    price: string
  }>
  total_amount: string
  created_at: string
}

type BookingListResponse = {
  data: BookingApiResponse[]
  page: number
  page_size: number
  total_items: number
  total_pages: number
}

type BookingDetail = {
  booking: Booking
  event: TicketRushEvent
  showtime: Showtime
  seats: Seat[]
  tickets: Ticket[]
}

function buildTicketsFromBooking(booking: BookingApiResponse, event: TicketRushEvent, status: Booking['status']): Ticket[] {
  if (status !== 'PAID') return []
  return booking.items.map((item, index) => {
    const ticketCode = `TR-${booking.id.slice(-6).toUpperCase()}-${index + 1}`
    return {
      id: `ticket-${booking.id}-${item.seat_id}`,
      bookingId: booking.id,
      showtimeId: booking.showtime_id,
      eventId: event.id,
      seatId: item.seat_id,
      ticketCode,
      qrPayload: JSON.stringify({
        ticketCode,
        bookingId: booking.id,
        event: event.name,
        seat: `${item.row}${item.number}`,
        kind: event.kind,
      }),
      issuedAt: booking.created_at,
    }
  })
}

async function mapBookingApiToDetail(bookingResponse: BookingApiResponse, userId = DEFAULT_USER_ID): Promise<BookingDetail | undefined> {
  const showtime = await getShowtime(bookingResponse.showtime_id)
  if (!showtime) return undefined
  const event = await getEvent(showtime.eventId)
  if (!event) return undefined
  const seatsStatus = await getSeatsStatus(bookingResponse.showtime_id)
  const seats = bookingResponse.items
    .map((item) => {
      const seat = seatsStatus.seats.find((statusSeat) => statusSeat.id === item.seat_id)
      if (seat) return seat
      return {
        id: item.seat_id,
        showtimeId: bookingResponse.showtime_id,
        section: 'Seat',
        row: item.row,
        number: item.number,
        seatClass: 'STANDARD' as const,
        price: Number(item.price),
        status: bookingResponse.status === 'PAID' ? ('SOLD' as const) : ('HOLDING' as const),
      }
    })
    .sort((first, second) => first.row.localeCompare(second.row) || first.number - second.number)

  return {
    booking: {
      id: bookingResponse.id,
      userId,
      showtimeId: bookingResponse.showtime_id,
      eventId: showtime.eventId,
      seatIds: bookingResponse.items.map((item) => item.seat_id),
      status: bookingResponse.status,
      totalAmount: Number(bookingResponse.total_amount),
      expiresAt: bookingResponse.expires_at,
      createdAt: bookingResponse.created_at,
    },
    event,
    showtime,
    seats,
    tickets: buildTicketsFromBooking(bookingResponse, event, bookingResponse.status),
  }
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

async function fetchEventApi<T>(path: string): Promise<T> {
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.eventBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) throw new Error('Unable to fetch event catalog from backend.')
  const payload = (await response.json()) as { data: T }
  return payload.data
}

async function postEventApi<T>(path: string, body: unknown): Promise<T> {
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.eventBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.eventBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
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
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.eventBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    method: 'PUT',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error('Unable to update showtimes from admin panel.')
  }
}

async function bookingApiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.bookingBaseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
    headers: {
      accept: 'application/json',
      ...(init?.body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  })

  if (!response.ok) {
    let message = 'Booking service request failed.'
    try {
      const payload = (await response.json()) as { message?: string }
      if (payload.message) message = payload.message
    } catch {
      // ignore parse error and keep default message
    }
    throw new Error(message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  const payload = (await response.json()) as ApiEnvelope<T>
  return payload.data
}

function bookingWebSocketUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const baseUrl = config.api.bookingBaseUrl
  const raw = `${baseUrl}${normalizedPath}`

  if (/^https?:\/\//i.test(raw)) {
    return raw.replace(/^http/i, 'ws')
  }

  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  const url = new URL(raw, origin)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
}

function normalizeRealtimeStatus(response: BookingSeatStatusResponse): RealtimeSeatStatus {
  return {
    showtimeId: response.showtime_id,
    seats: response.seats.map((seat) => ({
      id: seat.seat_id,
      row: seat.row,
      number: seat.number,
      seatClass: seat.seat_class,
      status: seat.status,
      price: seat.price ? Number(seat.price) : undefined,
      expiresAt: seat.expires_at,
    })),
    total: response.total,
    available: response.available,
    holding: response.holding,
    sold: response.sold,
  }
}

export function subscribeSeatsStatus(showtimeId: string, onStatus: (status: RealtimeSeatStatus) => void, onError?: () => void): () => void {
  if (typeof WebSocket === 'undefined') return () => { }

  let closed = false
  let reconnectTimer: number | undefined
  let socket: WebSocket | undefined

  const connect = () => {
    socket = new WebSocket(bookingWebSocketUrl(`/showtimes/${showtimeId}/seats/ws`))

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data as string) as SeatStatusSocketMessage
        if (message.type === 'seat_status') {
          onStatus(normalizeRealtimeStatus(message.data))
        }
      } catch {
        onError?.()
      }
    }

    socket.onerror = () => {
      onError?.()
    }

    socket.onclose = () => {
      if (closed) return
      reconnectTimer = window.setTimeout(connect, 2000)
    }
  }

  connect()

  return () => {
    closed = true
    if (reconnectTimer) window.clearTimeout(reconnectTimer)
    socket?.close()
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
      creatorId: item.creator_id ?? '',
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
      maxTicketsPerBooking: item.max_tickets_per_booking ?? null,
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
        queueEnabled: Boolean(apiShowtime.queue_enabled ?? item.is_flash_sale),
        queueLimit: apiShowtime.queue_limit ?? (item.is_flash_sale ? 1000 : undefined),
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
    creatorId: event.creatorId,
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
    maxTicketsPerBooking: event.maxTicketsPerBooking,
  }
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
  const response = await bookingApiRequest<BookingSeatStatusResponse>(`/showtimes/${encodeURIComponent(showtimeId)}/seats`)
  const normalized = normalizeRealtimeStatus(response)

  return {
    showtimeId: normalized.showtimeId,
    seats: normalized.seats
      .map((seat) => ({
        id: seat.id,
        showtimeId: normalized.showtimeId,
        section: 'Seat',
        row: seat.row,
        number: seat.number,
        seatClass: seat.seatClass,
        price: seat.price ?? 0,
        status: seat.status,
        expiresAt: seat.expiresAt,
      }))
      .sort((first, second) => first.row.localeCompare(second.row) || first.number - second.number),
    total: normalized.total,
    available: normalized.available,
    holding: normalized.holding,
    sold: normalized.sold,
  }
}

export async function holdSeats(showtimeId: string, seatIds: string[], userId = DEFAULT_USER_ID): Promise<Booking> {
  if (seatIds.length === 0) throw new Error('Select at least one seat.')

  const response = await bookingApiRequest<BookingApiResponse>('/bookings/hold', {
    method: 'POST',
    body: JSON.stringify({
      user_id: userId,
      showtime_id: showtimeId,
      seat_ids: seatIds,
    }),
  })
  const showtime = await getShowtime(response.showtime_id)

  return {
    id: response.id,
    userId,
    showtimeId: response.showtime_id,
    eventId: showtime?.eventId ?? '',
    seatIds: response.items.map((item) => item.seat_id),
    status: response.status,
    totalAmount: Number(response.total_amount),
    expiresAt: response.expires_at,
    createdAt: response.created_at,
  }
}

export async function getBookingDetail(bookingId: string): Promise<BookingDetail | undefined> {
  const bookingResponse = await bookingApiRequest<BookingApiResponse>(`/bookings/${encodeURIComponent(bookingId)}`)
  return mapBookingApiToDetail(bookingResponse)
}

export async function cancelBooking(bookingId: string): Promise<void> {
  await bookingApiRequest(`/bookings/${encodeURIComponent(bookingId)}/cancel`, { method: 'POST' })
}

export async function confirmBooking(bookingId: string): Promise<BookingDetail> {
  await bookingApiRequest(`/bookings/${encodeURIComponent(bookingId)}/confirm`, { method: 'POST' })
  const detail = await getBookingDetail(bookingId)
  if (!detail) throw new Error('Could not load booking after confirmation.')
  return detail
}

export async function listTickets(userId = DEFAULT_USER_ID): Promise<BookingDetail[]> {
  await ensureCatalogBootstrap()
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.bookingBaseUrl}/bookings/user/${encodeURIComponent(userId)}?page=1&page_size=50`, {
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) throw new Error('Unable to load your tickets from booking service.')
  const payload = (await response.json()) as BookingListResponse
  const paidBookings = payload.data.filter((booking) => booking.status === 'PAID')
  const details = await Promise.all(paidBookings.map((booking) => mapBookingApiToDetail(booking, userId)))
  return details.filter((detail): detail is BookingDetail => Boolean(detail))
}

export async function listBookingsByUser(userId = DEFAULT_USER_ID): Promise<BookingDetail[]> {
  await ensureCatalogBootstrap()
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.bookingBaseUrl}/bookings/user/${encodeURIComponent(userId)}?page=1&page_size=50`, {
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) throw new Error('Unable to load your booking history from booking service.')
  const payload = (await response.json()) as BookingListResponse
  const details = await Promise.all(payload.data.map((booking) => mapBookingApiToDetail(booking, userId)))
  return details.filter((detail): detail is BookingDetail => Boolean(detail))
}

export async function joinQueue(showtimeId: string): Promise<QueueSession> {
  const response = await bookingApiRequest<QueueApiResponse>(`/showtimes/${encodeURIComponent(showtimeId)}/queue/join`, {
    method: 'POST',
  })
  return {
    showtimeId: response.showtime_id,
    position: response.position,
    totalWaiting: response.total_waiting,
    inQueue: response.in_queue,
    canEnter: response.can_enter,
  }
}

export async function getQueueStatus(showtimeId: string): Promise<QueueSession> {
  const response = await bookingApiRequest<QueueApiResponse>(`/showtimes/${encodeURIComponent(showtimeId)}/queue/status`)
  return {
    showtimeId: response.showtime_id,
    position: response.position,
    totalWaiting: response.total_waiting,
    inQueue: response.in_queue,
    canEnter: response.can_enter,
  }
}

export async function heartbeatQueue(showtimeId: string): Promise<QueueSession> {
  const response = await bookingApiRequest<QueueApiResponse>(`/showtimes/${encodeURIComponent(showtimeId)}/queue/heartbeat`, {
    method: 'POST',
  })
  return {
    showtimeId: response.showtime_id,
    position: response.position,
    totalWaiting: response.total_waiting,
    inQueue: response.in_queue,
    canEnter: response.can_enter,
  }
}

export async function leaveQueue(showtimeId: string): Promise<void> {
  await bookingApiRequest(`/showtimes/${encodeURIComponent(showtimeId)}/queue/leave`, {
    method: 'POST',
  })
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
    max_tickets_per_booking: payload.maxTicketsPerBooking ?? null,
  }
  const created = await postEventApi<EventApiResponse>('/events', apiPayload)
  if (payload.showtimes?.length) {
    const showtimePayload: ReplaceShowtimesApiRequest = payload.showtimes.map((showtime, index) => {
      const start = new Date(`${showtime.date}T${showtime.time}:00`)
      const end = new Date(start.getTime() + (showtime.durationMs ?? 120 * 60 * 1000))
      return {
        ...(showtime.id ? { id: showtime.id } : {}),
        venue: showtime.venue,
        address: showtime.address,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        seat_map_name: showtime.seatMapName || `Auto map ${index + 1}`,
        queue_enabled: showtime.queueEnabled,
        ...(showtime.queueEnabled ? { queue_limit: showtime.queueLimit } : {}),
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
        : payload.durationMinutes ??
        Math.max(60, Math.min(360, Math.round((payload.sections.length || 2) * 60))),
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
    max_tickets_per_booking: payload.maxTicketsPerBooking ?? null,
  }
  await putEventApi<EventApiResponse>(`/events/${encodeURIComponent(eventId)}`, apiPayload)
  if (payload.showtimes?.length) {
    const showtimePayload: ReplaceShowtimesApiRequest = payload.showtimes.map((showtime, index) => {
      const start = new Date(`${showtime.date}T${showtime.time}:00`)
      const end = new Date(start.getTime() + (showtime.durationMs ?? 120 * 60 * 1000))
      return {
        ...(showtime.id ? { id: showtime.id } : {}),
        venue: showtime.venue,
        address: showtime.address,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        seat_map_name: showtime.seatMapName || `Auto map ${index + 1}`,
        queue_enabled: showtime.queueEnabled,
        ...(showtime.queueEnabled ? { queue_limit: showtime.queueLimit } : {}),
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
    queueLoad: state.queues.filter((queue) => queue.inQueue).length * 50 + holdingSeats,
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

// ---- Admin Dashboard Real API ----

export type AdminDashboardRevenuePoint = {
  date: string
  revenue: number
}

export type AdminDashboardStats = {
  // Booking counts
  total_bookings: number
  paid_bookings: number
  holding_bookings: number
  canceled_bookings: number
  expired_bookings: number

  // Seat / ticket counts
  tickets_sold: number
  total_seats: number
  available_seats: number
  holding_seats: number
  sold_seats: number

  // Revenue
  total_revenue: number

  // 7-day daily revenue series (oldest → newest)
  revenue_series: AdminDashboardRevenuePoint[]
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  return bookingApiRequest<AdminDashboardStats>('/admin/dashboard')
}

export async function getTotalEventsCount(): Promise<number> {
  const token = loadTokens()?.access_token
  const response = await fetch(`${config.api.eventBaseUrl}/events?page=1&page_size=1`, {
    headers: {
      accept: 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  })
  if (!response.ok) return 0
  const payload = (await response.json()) as { total_items?: number }
  return payload.total_items ?? 0
}
