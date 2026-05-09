import type { Seat, SeatClass, SeatSectionInput, Showtime, Soundtrack, TicketRushEvent, TicketRushState } from '../types'

const arenaSections: SeatSectionInput[] = [
  { name: 'Deluxe Pit', rowCount: 3, seatsPerRow: 12, seatClass: 'DELUXE', price: 3500000 },
  { name: 'VIP Floor', rowCount: 5, seatsPerRow: 14, seatClass: 'VIP', price: 2200000 },
  { name: 'Premium Bowl', rowCount: 6, seatsPerRow: 16, seatClass: 'PREMIUM', price: 1450000 },
  { name: 'Standard Bowl', rowCount: 7, seatsPerRow: 18, seatClass: 'STANDARD', price: 850000 },
]

const theaterSections: SeatSectionInput[] = [
  { name: 'Orchestra', rowCount: 4, seatsPerRow: 10, seatClass: 'VIP', price: 1500000 },
  { name: 'Mezzanine', rowCount: 5, seatsPerRow: 12, seatClass: 'PREMIUM', price: 950000 },
  { name: 'Gallery', rowCount: 5, seatsPerRow: 14, seatClass: 'STANDARD', price: 520000 },
]

const cinemaSections: SeatSectionInput[] = [
  { name: 'Couple Prime', rowCount: 2, seatsPerRow: 10, seatClass: 'DELUXE', price: 280000 },
  { name: 'Center VIP', rowCount: 5, seatsPerRow: 14, seatClass: 'VIP', price: 210000 },
  { name: 'Standard', rowCount: 6, seatsPerRow: 16, seatClass: 'STANDARD', price: 145000 },
]

function soundtrack(movieEventId: string, title: string, artist: string, suffix: string): Soundtrack {
  return {
    id: `${movieEventId}-${suffix}`,
    movieEventId,
    title,
    artist,
    isrc: `TR${suffix.toUpperCase()}2026`,
    externalId: `acr-${movieEventId}-${suffix}`,
  }
}

const movieSoundtracks = {
  skyward: [
    soundtrack('skyward-dreams-imax', 'Skyward Theme', 'Mira Vale', 'skyward-theme'),
    soundtrack('skyward-dreams-imax', 'Lanterns Over Tokyo', 'Aki Tanaka', 'lanterns'),
    soundtrack('skyward-dreams-imax', 'A Promise in Blue', 'Mira Vale', 'promise-blue'),
  ],
  echoes: [
    soundtrack('echoes-of-saturn', 'Saturn Signal', 'Nova Choir', 'saturn-signal'),
    soundtrack('echoes-of-saturn', 'Deep Orbit Lullaby', 'Lena Cross', 'orbit-lullaby'),
  ],
  midnight: [
    soundtrack('midnight-cafe-screening', 'Midnight Cafe Waltz', 'The Velvet Notes', 'cafe-waltz'),
    soundtrack('midnight-cafe-screening', 'Rain on Window Seats', 'June Park', 'rain-window'),
  ],
}

const events: TicketRushEvent[] = [
  {
    id: 'aurora-pop-live',
    creatorId: 'sys-demo',
    showtimeId: 'st-aurora-pop-live',
    kind: 'EVENT',
    name: 'Aurora Pop Live',
    category: 'Music',
    date: '2026-05-12',
    time: '20:00',
    venue: 'Sao Mai Arena',
    city: 'Ha Noi',
    address: '12 Pham Hung, Nam Tu Liem, Ha Noi',
    organizer: 'TicketRush Entertainment',
    priceFrom: 850000,
    imageUrl: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1000&q=80',
    status: 'Flash Sale',
    capacity: 268,
    sold: 172,
    tags: ['flash sale', 'pop', 'arena'],
    description: 'A high-demand pop concert built to demonstrate virtual queueing, real-time seat updates, and ticket lifecycle control.',
    saleOpensAt: '2026-05-01T02:00:00.000Z',
    isFlashSale: true,
  },
  {
    id: 'city-finals-night',
    creatorId: 'sys-demo',
    showtimeId: 'st-city-finals-night',
    kind: 'EVENT',
    name: 'City Finals Night',
    category: 'Sports',
    date: '2026-05-15',
    time: '19:30',
    venue: 'Metro Arena',
    city: 'Ho Chi Minh City',
    address: '88 Nguyen Huu Canh, Binh Thanh, Ho Chi Minh City',
    organizer: 'TicketRush Sports',
    priceFrom: 520000,
    imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1000&q=80',
    status: 'Almost Sold Out',
    capacity: 146,
    sold: 118,
    tags: ['finals', 'family', 'arena'],
    description: 'A packed city final with VIP courtside seating, family zones, and live seat status polling.',
    saleOpensAt: '2026-05-02T02:00:00.000Z',
    isFlashSale: true,
  },
  {
    id: 'little-moon-stage',
    creatorId: 'sys-demo',
    showtimeId: 'st-little-moon-stage',
    kind: 'EVENT',
    name: 'Little Moon Stage',
    category: 'Theater',
    date: '2026-05-18',
    time: '18:30',
    venue: 'Orchid Theater',
    city: 'Da Nang',
    address: '5 Tran Phu, Hai Chau, Da Nang',
    organizer: 'TicketRush Stage',
    priceFrom: 520000,
    imageUrl: 'https://images.unsplash.com/photo-1503095396549-807759245b35?auto=format&fit=crop&w=1000&q=80',
    status: 'Available',
    capacity: 146,
    sold: 64,
    tags: ['family', 'musical', 'seated'],
    description: 'A family musical with assigned seating, QR tickets, and a live dashboard for occupancy tracking.',
    saleOpensAt: '2026-05-04T02:00:00.000Z',
    isFlashSale: false,
  },
  {
    id: 'skyward-dreams-imax',
    creatorId: 'sys-demo',
    showtimeId: 'st-skyward-dreams-imax',
    kind: 'MOVIE',
    name: 'Skyward Dreams',
    category: 'Cinema',
    date: '2026-05-20',
    time: '19:00',
    venue: 'Galaxy Central - Screen 1',
    city: 'Ha Noi',
    address: '191 Ba Trieu, Hai Ba Trung, Ha Noi',
    organizer: 'TicketRush Cinema',
    priceFrom: 145000,
    imageUrl: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?auto=format&fit=crop&w=1000&q=80',
    status: 'Flash Sale',
    capacity: 188,
    sold: 121,
    tags: ['movie', 'imax', 'soundtrack search'],
    description: 'A visually rich anime-inspired feature with a soundtrack that can be discovered through humming search.',
    saleOpensAt: '2026-05-09T02:00:00.000Z',
    isFlashSale: true,
    movie: {
      director: 'Kaito Mori',
      cast: ['Lina Tran', 'Haruto Sato', 'Mina Reyes'],
      durationMinutes: 118,
      ageRating: 'PG-13',
      trailerUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      genres: ['Animation', 'Romance', 'Fantasy'],
      synopsis: 'Two strangers are connected by a melody that appears whenever the city lights turn blue.',
    },
    soundtracks: movieSoundtracks.skyward,
  },
  {
    id: 'echoes-of-saturn',
    creatorId: 'sys-demo',
    showtimeId: 'st-echoes-of-saturn',
    kind: 'MOVIE',
    name: 'Echoes of Saturn',
    category: 'Cinema',
    date: '2026-05-25',
    time: '21:15',
    venue: 'Lotte Star - Screen 3',
    city: 'Ho Chi Minh City',
    address: '54 Lieu Giai, District 1, Ho Chi Minh City',
    organizer: 'TicketRush Cinema',
    priceFrom: 145000,
    imageUrl: 'https://images.unsplash.com/photo-1440404653325-ab127d49abc1?auto=format&fit=crop&w=1000&q=80',
    status: 'Available',
    capacity: 188,
    sold: 84,
    tags: ['movie', 'sci-fi', 'dolby atmos'],
    description: 'A sci-fi cinema event with a controlled seat map and soundtrack-led discovery.',
    saleOpensAt: '2026-05-11T02:00:00.000Z',
    isFlashSale: false,
    movie: {
      director: 'Amelia North',
      cast: ['Iris Cole', 'Noah Bennett', 'Theo Minh'],
      durationMinutes: 132,
      ageRating: 'T13',
      trailerUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      genres: ['Sci-Fi', 'Drama', 'Adventure'],
      synopsis: 'A research crew follows a signal that sounds like a lullaby from Saturns rings.',
    },
    soundtracks: movieSoundtracks.echoes,
  },
  {
    id: 'midnight-cafe-screening',
    creatorId: 'sys-demo',
    showtimeId: 'st-midnight-cafe-screening',
    kind: 'MOVIE',
    name: 'Midnight Cafe',
    category: 'Cinema',
    date: '2026-06-01',
    time: '20:30',
    venue: 'Indie House - Room A',
    city: 'Da Nang',
    address: '21 Bach Dang, Hai Chau, Da Nang',
    organizer: 'TicketRush Cinema',
    priceFrom: 145000,
    imageUrl: 'https://images.unsplash.com/photo-1517604931442-7e0c8ed2963c?auto=format&fit=crop&w=1000&q=80',
    status: 'Almost Sold Out',
    capacity: 188,
    sold: 141,
    tags: ['movie', 'romance', 'indie'],
    description: 'A late-night romance screening where soundtrack search is the fastest path to booking.',
    saleOpensAt: '2026-05-14T02:00:00.000Z',
    isFlashSale: true,
    movie: {
      director: 'Sofia Le',
      cast: ['Nora Vu', 'Evan Stone', 'Mai Hanh'],
      durationMinutes: 105,
      ageRating: 'T16',
      trailerUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
      genres: ['Romance', 'Music', 'Drama'],
      synopsis: 'A jazz pianist and a film student meet every midnight in a cafe that only exists during rain.',
    },
    soundtracks: movieSoundtracks.midnight,
  },
]

function makeShowtime(event: TicketRushEvent): Showtime {
  return {
    id: event.showtimeId,
    eventId: event.id,
    venue: event.venue,
    address: event.address,
    startTime: `${event.date}T${event.time}:00+07:00`,
    endTime: `${event.date}T23:00:00+07:00`,
    seatMapName: event.kind === 'MOVIE' ? `${event.venue} seating map` : `${event.venue} main seating map`,
    cinemaName: event.kind === 'MOVIE' ? event.venue.split(' - ')[0] : undefined,
    screenName: event.kind === 'MOVIE' ? event.venue.split(' - ')[1] ?? 'Main Screen' : undefined,
    format: event.kind === 'MOVIE' ? (event.id.includes('imax') ? 'IMAX' : '2D') : undefined,
  }
}

function rowLabel(index: number): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  return alphabet[index % alphabet.length]
}

export function generateSeats(showtimeId: string, sections: SeatSectionInput[], soldCount = 0): Seat[] {
  const seats: Seat[] = []
  let globalRow = 0

  sections.forEach((section) => {
    for (let row = 0; row < section.rowCount; row += 1) {
      const label = rowLabel(globalRow)
      for (let number = 1; number <= section.seatsPerRow; number += 1) {
        seats.push({
          id: `${showtimeId}-${section.name.toLowerCase().replace(/\s+/g, '-')}-${label}${number}`,
          showtimeId,
          section: section.name,
          row: label,
          number,
          seatClass: section.seatClass,
          price: section.price,
          status: 'AVAILABLE',
        })
      }
      globalRow += 1
    }
  })

  seats.slice(0, soldCount).forEach((seat) => {
    seat.status = 'SOLD'
    seat.bookingId = `seed-${showtimeId}`
  })

  return seats
}

export function buildDemoTicketRushState(): TicketRushState {
  const showtimes = events.map(makeShowtime)
  const seats = events.flatMap((event, index) => {
    const sections = event.kind === 'MOVIE' ? cinemaSections : index % 2 === 0 ? arenaSections : theaterSections
    return generateSeats(event.showtimeId, sections, event.sold)
  })

  return {
    events,
    showtimes,
    seats,
    bookings: [],
    tickets: [],
    queues: [],
    notifications: [
      {
        id: 'notice-queue',
        userId: 'demo-customer',
        title: 'Flash sale access ready',
        message: 'Aurora Pop Live is using a waiting room. Join early to keep your position.',
        tone: 'INFO',
        read: false,
        createdAt: '2026-04-29T08:00:00.000Z',
        link: '/events/aurora-pop-live',
      },
      {
        id: 'notice-movie',
        userId: 'demo-customer',
        title: 'Sound search is live',
        message: 'Hum a soundtrack and TicketRush will suggest the matching movie showtime.',
        tone: 'SUCCESS',
        read: false,
        createdAt: '2026-04-29T09:30:00.000Z',
        link: '/sound-search',
      },
    ],
    soundSearchLogs: [
      {
        id: 'sound-log-1',
        songTitle: 'Skyward Theme',
        movieName: 'Skyward Dreams',
        confidence: 94,
        conversionStatus: 'Opened seats',
        createdAt: '2026-04-29T08:30:00.000Z',
      },
      {
        id: 'sound-log-2',
        songTitle: 'Midnight Cafe Waltz',
        movieName: 'Midnight Cafe',
        confidence: 89,
        conversionStatus: 'Matched',
        createdAt: '2026-04-29T09:12:00.000Z',
      },
    ],
  }
}

export function priceLabelForClass(seatClass: SeatClass): string {
  if (seatClass === 'DELUXE') return 'Deluxe'
  if (seatClass === 'PREMIUM') return 'Premium'
  if (seatClass === 'VIP') return 'VIP'
  return 'Standard'
}
