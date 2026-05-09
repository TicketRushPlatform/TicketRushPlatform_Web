export type EventKind = 'EVENT' | 'MOVIE'

export type EventCategory =
  | 'Music'
  | 'Sports'
  | 'Theater'
  | 'Festival'
  | 'Workshop'
  | 'Comedy'
  | 'Cinema'

export type TicketStatus = 'Flash Sale' | 'Available' | 'Almost Sold Out' | 'Sold Out'

export type SeatClass = 'STANDARD' | 'VIP' | 'PREMIUM' | 'DELUXE'
export type SeatStatus = 'AVAILABLE' | 'HOLDING' | 'SOLD'
export type BookingStatus = 'HOLDING' | 'PAID' | 'CANCELED' | 'EXPIRED'

export type MovieMetadata = {
  director: string
  cast: string[]
  durationMinutes: number
  ageRating: string
  trailerUrl: string
  genres: string[]
  synopsis: string
}

export type Soundtrack = {
  id: string
  movieEventId: string
  title: string
  artist: string
  isrc?: string
  externalId?: string
}

export type EventItem = {
  id: string
  creatorId: string
  kind: EventKind
  name: string
  category: EventCategory
  date: string
  time: string
  venue: string
  city: string
  priceFrom: number
  imageUrl: string
  status: TicketStatus
  capacity: number
  sold: number
  tags: string[]
  description: string
  showtimeId: string
  isFlashSale: boolean
  movie?: MovieMetadata
  soundtracks?: Soundtrack[]
  maxTicketsPerBooking?: number | null
}

export type TicketRushEvent = EventItem & {
  address: string
  organizer: string
  saleOpensAt: string
}

export type Showtime = {
  id: string
  eventId: string
  venue: string
  address: string
  startTime: string
  endTime: string
  seatMapName: string
  queueEnabled?: boolean
  queueLimit?: number
  cinemaName?: string
  screenName?: string
  format?: string
}

export type Seat = {
  id: string
  showtimeId: string
  section: string
  row: string
  number: number
  seatClass: SeatClass
  price: number
  status: SeatStatus
  bookingId?: string
  expiresAt?: string
}

export type SeatSectionInput = {
  name: string
  rowCount: number
  seatsPerRow: number
  seatClass: SeatClass
  price: number
}

export type Booking = {
  id: string
  userId: string
  showtimeId: string
  eventId: string
  seatIds: string[]
  status: BookingStatus
  totalAmount: number
  expiresAt?: string
  createdAt: string
}

export type Ticket = {
  id: string
  bookingId: string
  showtimeId: string
  eventId: string
  seatId: string
  ticketCode: string
  qrPayload: string
  issuedAt: string
  usedAt?: string
}

export type QueueSession = {
  token: string
  showtimeId: string
  position: number
  batchSize: number
  accessGranted: boolean
  accessToken?: string
  createdAt: string
}

export type NotificationItem = {
  id: string
  userId: string
  title: string
  message: string
  tone: 'INFO' | 'SUCCESS' | 'WARNING'
  read: boolean
  createdAt: string
  link?: string
}

export type SoundSearchLog = {
  id: string
  songTitle: string
  movieName: string
  confidence: number
  conversionStatus: 'Matched' | 'Opened seats' | 'Booked'
  createdAt: string
}

export type SoundSearchResult = {
  id: string
  soundtrack: Soundtrack
  event: TicketRushEvent
  nextShowtime?: Showtime
  confidence: number
  matchedPhrase: string
}

export type DashboardMetrics = {
  totalEvents: number
  totalMovies: number
  ticketsSold: number
  revenue: number
  eventRevenue: number
  movieRevenue: number
  customers: number
  fillRate: number
  queueLoad: number
  availableSeats: number
  holdingSeats: number
  soldSeats: number
  revenueSeries: number[]
  categoryMix: Array<{ label: EventCategory; value: number; color: string }>
  ageGroups: Array<{ label: string; value: number }>
  genderMix: Array<{ label: string; value: number; color: string }>
  activeEvents: Array<{
    id: string
    name: string
    kind: EventKind
    category: EventCategory
    date: string
    status: TicketStatus
    sold: number
    capacity: number
    revenue: number
  }>
  topMovies: Array<{
    id: string
    name: string
    sold: number
    capacity: number
    revenue: number
  }>
  soundtrackInsights: SoundSearchLog[]
}

export type TicketRushState = {
  events: TicketRushEvent[]
  showtimes: Showtime[]
  seats: Seat[]
  bookings: Booking[]
  tickets: Ticket[]
  queues: QueueSession[]
  notifications: NotificationItem[]
  soundSearchLogs: SoundSearchLog[]
}
