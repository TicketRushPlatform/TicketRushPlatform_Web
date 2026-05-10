import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Film,
  LoaderCircle,
  Mic,
  MicOff,
  Search,
  Star,
  CalendarPlus,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  discoverMovies,
  getEnrichedMovieDetail,
  searchMovies,
  tmdbImageUrl,
  type EnrichedTmdbMovie,
  type TmdbFilterType,
  type TmdbMovie,
} from '../services/tmdbApi'

const FILTER_OPTIONS: Array<{ value: TmdbFilterType; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'now_playing', label: 'Now Playing' },
  { value: 'popular', label: 'Popular' },
  { value: 'top_rated', label: 'Top Rated' },
]

export function AdminMoviesPage() {
  const navigate = useNavigate()
  const [movies, setMovies] = useState<TmdbMovie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<TmdbFilterType>('upcoming')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalResults, setTotalResults] = useState(0)
  const [genreMap, setGenreMap] = useState<Record<number, string>>({})
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null)
  const [enrichedDetail, setEnrichedDetail] = useState<EnrichedTmdbMovie | null>(null)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<number>(0)
  const isSearchMode = searchQuery.trim().length > 0
  const [isListening, setIsListening] = useState(false)
  const recognitionRef = useRef<any>(null)

  // Load genre cache
  useEffect(() => {
    import('../services/tmdbApi').then(({ getGenres }) =>
      getGenres().then((genres) => {
        const map: Record<number, string> = {}
        for (const g of genres) map[g.id] = g.name
        setGenreMap(map)
      }),
    )
  }, [])

  const loadMovies = useCallback(async (filter: TmdbFilterType, p: number, query: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const result = query.trim()
        ? await searchMovies(query, p)
        : await discoverMovies(filter, p)
      setMovies(result.results)
      setTotalPages(Math.min(result.total_pages, 500))
      setTotalResults(result.total_results)
    } catch {
      setError('Failed to fetch movies from TMDB. Please try again.')
      setMovies([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMovies(activeFilter, page, searchQuery)
  }, [activeFilter, page, loadMovies]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleSearch(value: string) {
    setSearchQuery(value)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = window.setTimeout(() => {
      setPage(1)
      void loadMovies(activeFilter, 1, value)
    }, 500)
  }

  function handleFilterChange(filter: TmdbFilterType) {
    setActiveFilter(filter)
    setSearchQuery('')
    setPage(1)
  }

  async function handleMovieClick(movie: TmdbMovie) {
    setSelectedMovie(movie)
    setIsLoadingDetail(true)
    setEnrichedDetail(null)
    try {
      const enriched = await getEnrichedMovieDetail(movie.id)
      setEnrichedDetail(enriched)
    } catch {
      setError('Failed to load movie details.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function handleCloseDetail() {
    setSelectedMovie(null)
    setEnrichedDetail(null)
  }

  function handleCreateEvent() {
    if (!enrichedDetail) return
    // Navigate to create event page with TMDB movie data as state
    navigate('/admin/events/new', {
      state: { tmdbMovie: enrichedDetail },
    })
  }

  return (
    <section className="admin-movies-page" aria-labelledby="admin-movies-title">
      <div className="admin-hero create-hero">
        <div>
          <p className="eyebrow">
            <Film size={18} strokeWidth={2.5} />
            Movie Catalog
          </p>
          <h1 id="admin-movies-title">TMDB Movies</h1>
        </div>
        <Link className="secondary-button compact-link" to="/admin">
          <ArrowLeft size={18} strokeWidth={2.5} />
          Back to dashboard
        </Link>
      </div>

      {/* Controls */}
      <div className="admin-panel" style={{ padding: 24, marginBottom: 22 }}>
        <div className="movie-picker-controls">
          <div className="movie-picker-search">
            <Search size={18} strokeWidth={2.5} />
            <input
              type="text"
              placeholder="Search movies on TMDB..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
            />
            <button
              type="button"
              className={`mic-search-button ${isListening ? 'listening' : ''}`}
              aria-label={isListening ? 'Stop voice search' : 'Voice search'}
              onClick={() => {
                if (isListening) {
                  recognitionRef.current?.stop()
                  setIsListening(false)
                  return
                }
                const SpeechRecognitionApi = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
                if (!SpeechRecognitionApi) {
                  setError('Voice search is not supported in this browser.')
                  return
                }
                const recognition = new SpeechRecognitionApi()
                recognition.lang = 'en-US'
                recognition.interimResults = false
                recognition.maxAlternatives = 1
                recognition.onresult = (event: any) => {
                  const transcript = event.results[0]?.[0]?.transcript ?? ''
                  if (transcript) {
                    setSearchQuery(transcript)
                    setPage(1)
                    void loadMovies(activeFilter, 1, transcript)
                  }
                  setIsListening(false)
                }
                recognition.onerror = () => setIsListening(false)
                recognition.onend = () => setIsListening(false)
                recognitionRef.current = recognition
                recognition.start()
                setIsListening(true)
              }}
            >
              {isListening ? <MicOff size={18} strokeWidth={2.5} /> : <Mic size={18} strokeWidth={2.5} />}
            </button>
          </div>
          <div className="movie-picker-filters">
            {FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`movie-filter-chip ${activeFilter === opt.value && !isSearchMode ? 'active' : ''}`}
                type="button"
                onClick={() => handleFilterChange(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {!isLoading && (
          <p style={{ marginTop: 12, color: 'var(--muted-foreground)', fontSize: '0.85rem', fontWeight: 700 }}>
            {isSearchMode
              ? `Found ${totalResults.toLocaleString()} results for "${searchQuery}"`
              : `Showing ${FILTER_OPTIONS.find((o) => o.value === activeFilter)?.label} movies`}
            {' · '}Page {page} of {totalPages}
          </p>
        )}
      </div>

      {error && (
        <div className="auth-notice error" style={{ marginBottom: 16 }}>
          <p>{error}</p>
        </div>
      )}

      {/* Movie Grid */}
      {isLoading ? (
        <div className="movie-picker-loading" style={{ minHeight: 400 }}>
          <LoaderCircle className="spin" size={36} strokeWidth={2.5} />
          <p>Loading movies from TMDB...</p>
        </div>
      ) : movies.length === 0 ? (
        <div className="movie-picker-loading" style={{ minHeight: 400 }}>
          <Film size={36} strokeWidth={2.5} />
          <p>No movies found. Try a different search term or filter.</p>
        </div>
      ) : (
        <div className="admin-movie-grid">
          {movies.map((movie) => (
            <button
              className="admin-movie-card"
              key={movie.id}
              type="button"
              onClick={() => handleMovieClick(movie)}
            >
              <div className="admin-movie-card-poster">
                {movie.poster_path ? (
                  <img
                    src={tmdbImageUrl(movie.poster_path, 'w342')}
                    alt={movie.title}
                    loading="lazy"
                  />
                ) : (
                  <div className="movie-picker-card-no-poster">
                    <Clapperboard size={36} />
                  </div>
                )}
                <div className="admin-movie-card-overlay">
                  <span>View Details</span>
                </div>
                <div className="movie-picker-card-rating">
                  <Star size={12} strokeWidth={2.5} />
                  <span>{movie.vote_average.toFixed(1)}</span>
                </div>
              </div>
              <div className="admin-movie-card-info">
                <h3>{movie.title}</h3>
                <div className="admin-movie-card-meta">
                  <span>{movie.release_date?.slice(0, 4) || 'TBA'}</span>
                  <span>
                    {movie.genre_ids
                      .slice(0, 2)
                      .map((id) => genreMap[id] ?? '')
                      .filter(Boolean)
                      .join(' · ') || 'Movie'}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && totalPages > 1 && (
        <div className="movie-picker-pagination" style={{ marginTop: 24 }}>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft size={18} strokeWidth={2.5} />
            Previous
          </button>
          <div className="movie-pagination-numbers">
            {generatePageNumbers(page, totalPages).map((p, idx) =>
              p === '...' ? (
                <span key={`ellipsis-${idx}`} className="movie-page-ellipsis">…</span>
              ) : (
                <button
                  key={p}
                  className={`movie-page-number ${p === page ? 'active' : ''}`}
                  type="button"
                  onClick={() => setPage(p as number)}
                >
                  {p}
                </button>
              ),
            )}
          </div>
          <button
            className="secondary-button compact-button"
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
            <ChevronRight size={18} strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Movie Detail Modal */}
      {selectedMovie && (
        <div className="modal-backdrop blurred" onClick={handleCloseDetail} style={{ zIndex: 60 }}>
          <div
            className="ticket-modal movie-detail-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button className="modal-close" type="button" onClick={handleCloseDetail} aria-label="Close">
              <X size={20} strokeWidth={2.5} />
            </button>

            {isLoadingDetail ? (
              <div className="movie-picker-loading" style={{ minHeight: 300 }}>
                <LoaderCircle className="spin" size={32} strokeWidth={2.5} />
                <p>Loading movie details...</p>
              </div>
            ) : enrichedDetail ? (
              <div className="movie-detail-layout">
                <div className="movie-detail-poster-col">
                  {enrichedDetail.posterUrl ? (
                    <img
                      className="movie-detail-poster-img"
                      src={enrichedDetail.posterUrl}
                      alt={enrichedDetail.title}
                    />
                  ) : (
                    <div className="movie-detail-poster-placeholder">
                      <Clapperboard size={48} />
                    </div>
                  )}
                </div>
                <div className="movie-detail-info-col">
                  <h2>{enrichedDetail.title}</h2>
                  {enrichedDetail.originalTitle !== enrichedDetail.title && (
                    <p className="movie-detail-original-title">{enrichedDetail.originalTitle}</p>
                  )}

                  <div className="movie-detail-badges">
                    <span className="movie-detail-badge rating">
                      <Star size={14} strokeWidth={2.5} />
                      {enrichedDetail.voteAverage.toFixed(1)}
                    </span>
                    <span className="movie-detail-badge runtime">
                      <Clock size={14} strokeWidth={2.5} />
                      {enrichedDetail.runtime} min
                    </span>
                    <span className="movie-detail-badge age">
                      {enrichedDetail.ageRating}
                    </span>
                  </div>

                  <div className="movie-detail-genre-row">
                    {enrichedDetail.genres.map((g) => (
                      <span className="chip" key={g}>{g}</span>
                    ))}
                  </div>

                  <p className="movie-detail-overview">{enrichedDetail.overview}</p>

                  <dl className="movie-detail-facts">
                    <div>
                      <dt>Director</dt>
                      <dd>{enrichedDetail.director}</dd>
                    </div>
                    <div>
                      <dt>Cast</dt>
                      <dd>{enrichedDetail.cast.join(', ')}</dd>
                    </div>
                    <div>
                      <dt>Release Date</dt>
                      <dd>{enrichedDetail.releaseDate || 'TBA'}</dd>
                    </div>
                    <div>
                      <dt>Language</dt>
                      <dd>{enrichedDetail.language}</dd>
                    </div>
                  </dl>

                  {enrichedDetail.trailerUrl && (
                    <div className="movie-detail-trailer">
                      <h3>Trailer</h3>
                      <div className="trailer-frame">
                        <iframe
                          title={`${enrichedDetail.title} trailer`}
                          src={enrichedDetail.trailerUrl}
                          allowFullScreen
                        />
                      </div>
                    </div>
                  )}

                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={handleCreateEvent}
                    style={{ marginTop: 20 }}
                  >
                    <CalendarPlus size={18} strokeWidth={2.5} />
                    Create Event for this Movie
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </section>
  )
}

function generatePageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)
  for (let i = start; i <= end; i++) pages.push(i)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}
