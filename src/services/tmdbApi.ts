/**
 * TMDB (The Movie Database) API service
 * Provides movie search, discovery, and detail fetching.
 * Uses the public TMDB v3 API.
 */

const TMDB_API_TOKEN = import.meta.env.VITE_TMDB_API_TOKEN || ''
const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p'

export type TmdbMovie = {
  id: number
  title: string
  original_title: string
  overview: string
  poster_path: string | null
  backdrop_path: string | null
  release_date: string
  vote_average: number
  vote_count: number
  genre_ids: number[]
  popularity: number
  adult: boolean
  original_language: string
}

export type TmdbMovieDetail = TmdbMovie & {
  runtime: number | null
  genres: Array<{ id: number; name: string }>
  production_companies: Array<{ id: number; name: string; logo_path: string | null; origin_country: string }>
  production_countries: Array<{ iso_3166_1: string; name: string }>
  spoken_languages: Array<{ iso_639_1: string; name: string; english_name: string }>
  status: string
  tagline: string
  budget: number
  revenue: number
  homepage: string
  imdb_id: string | null
  belongs_to_collection: { id: number; name: string; poster_path: string | null; backdrop_path: string | null } | null
}

export type TmdbCredits = {
  id: number
  cast: Array<{
    id: number
    name: string
    character: string
    profile_path: string | null
    order: number
  }>
  crew: Array<{
    id: number
    name: string
    job: string
    department: string
    profile_path: string | null
  }>
}

export type TmdbVideoResult = {
  id: string
  key: string
  name: string
  site: string
  type: string
  official: boolean
}

export type TmdbGenre = {
  id: number
  name: string
}

export type TmdbPaginatedResponse<T> = {
  page: number
  results: T[]
  total_pages: number
  total_results: number
}

// Genre cache
let genreCachePromise: Promise<TmdbGenre[]> | null = null

export function tmdbImageUrl(path: string | null, size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'): string {
  if (!path) return ''
  return `${TMDB_IMAGE_BASE}/${size}${path}`
}

async function tmdbFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${TMDB_BASE}${endpoint}`)
  url.searchParams.set('language', 'en-US')
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value)
  }
  const headers: Record<string, string> = {
    'Accept': 'application/json'
  }
  if (TMDB_API_TOKEN) {
    headers['Authorization'] = `Bearer ${TMDB_API_TOKEN}`
  }
  const response = await fetch(url.toString(), { headers })
  if (!response.ok) throw new Error(`TMDB API error: ${response.status}`)
  return response.json() as Promise<T>
}

export type TmdbFilterType = 'upcoming' | 'now_playing' | 'popular' | 'top_rated'

export async function discoverMovies(
  filter: TmdbFilterType = 'upcoming',
  page = 1,
): Promise<TmdbPaginatedResponse<TmdbMovie>> {
  const endpoint = `/movie/${filter}`
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovie>>(endpoint, { page: String(page) })
}

export async function searchMovies(
  query: string,
  page = 1,
): Promise<TmdbPaginatedResponse<TmdbMovie>> {
  if (!query.trim()) return { page: 1, results: [], total_pages: 0, total_results: 0 }
  return tmdbFetch<TmdbPaginatedResponse<TmdbMovie>>('/search/movie', {
    query: query.trim(),
    page: String(page),
  })
}

export async function getMovieDetail(movieId: number): Promise<TmdbMovieDetail> {
  return tmdbFetch<TmdbMovieDetail>(`/movie/${movieId}`)
}

export async function getMovieCredits(movieId: number): Promise<TmdbCredits> {
  return tmdbFetch<TmdbCredits>(`/movie/${movieId}/credits`)
}

export async function getMovieVideos(movieId: number): Promise<TmdbVideoResult[]> {
  const data = await tmdbFetch<{ results: TmdbVideoResult[] }>(`/movie/${movieId}/videos`)
  return data.results
}

export async function getGenres(): Promise<TmdbGenre[]> {
  if (!genreCachePromise) {
    genreCachePromise = tmdbFetch<{ genres: TmdbGenre[] }>('/genre/movie/list').then((data) => data.genres)
  }
  return genreCachePromise
}

/** Resolve genre IDs to names using cached genre list. */
export async function resolveGenreNames(genreIds: number[]): Promise<string[]> {
  const genres = await getGenres()
  return genreIds
    .map((id) => genres.find((g) => g.id === id)?.name)
    .filter((name): name is string => Boolean(name))
}

/** Find the best YouTube trailer from video list. */
export function findTrailerUrl(videos: TmdbVideoResult[]): string {
  const trailer = videos.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer' && v.official,
  ) ?? videos.find(
    (v) => v.site === 'YouTube' && v.type === 'Trailer',
  ) ?? videos.find(
    (v) => v.site === 'YouTube',
  )
  if (!trailer) return ''
  return `https://www.youtube.com/embed/${trailer.key}`
}

/** Build a fully enriched movie detail with credits and trailer. */
export type EnrichedTmdbMovie = {
  tmdbId: number
  title: string
  originalTitle: string
  overview: string
  posterUrl: string
  backdropUrl: string
  releaseDate: string
  voteAverage: number
  runtime: number
  genres: string[]
  director: string
  cast: string[]
  trailerUrl: string
  ageRating: string
  language: string
}

export async function getEnrichedMovieDetail(movieId: number): Promise<EnrichedTmdbMovie> {
  const [detail, credits, videos] = await Promise.all([
    getMovieDetail(movieId),
    getMovieCredits(movieId),
    getMovieVideos(movieId),
  ])

  const director = credits.crew.find((c) => c.job === 'Director')?.name ?? 'Unknown'
  const cast = credits.cast
    .sort((a, b) => a.order - b.order)
    .slice(0, 8)
    .map((c) => c.name)

  return {
    tmdbId: detail.id,
    title: detail.title,
    originalTitle: detail.original_title,
    overview: detail.overview || 'No synopsis available.',
    posterUrl: tmdbImageUrl(detail.poster_path, 'w500'),
    backdropUrl: tmdbImageUrl(detail.backdrop_path, 'w780'),
    releaseDate: detail.release_date ?? '',
    voteAverage: detail.vote_average,
    runtime: detail.runtime ?? 120,
    genres: detail.genres.map((g) => g.name),
    director,
    cast,
    trailerUrl: findTrailerUrl(videos),
    ageRating: detail.adult ? '18+' : 'PG-13',
    language: detail.spoken_languages?.[0]?.english_name ?? detail.original_language ?? 'English',
  }
}
