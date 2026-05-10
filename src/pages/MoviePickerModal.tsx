import {
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Clock,
  Film,
  LoaderCircle,
  Search,
  Star,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  discoverMovies,
  getEnrichedMovieDetail,
  resolveGenreNames,
  searchMovies,
  tmdbImageUrl,
  type EnrichedTmdbMovie,
  type TmdbFilterType,
  type TmdbMovie,
} from '../services/tmdbApi'

type MoviePickerProps = {
  onSelect: (movie: EnrichedTmdbMovie) => void
  onClose: () => void
}

const FILTER_OPTIONS: Array<{ value: TmdbFilterType; label: string }> = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'now_playing', label: 'Now Playing' },
  { value: 'popular', label: 'Popular' },
  { value: 'top_rated', label: 'Top Rated' },
]

export function MoviePickerModal({ onSelect, onClose }: MoviePickerProps) {
  const [movies, setMovies] = useState<TmdbMovie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<TmdbFilterType>('upcoming')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [genreMap, setGenreMap] = useState<Record<number, string>>({})
  const [selectedMovie, setSelectedMovie] = useState<TmdbMovie | null>(null)
  const [enrichedDetail, setEnrichedDetail] = useState<EnrichedTmdbMovie | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchTimeoutRef = useRef<number>(0)
  const isSearchMode = searchQuery.trim().length > 0

  // Lock body scroll
  useEffect(() => {
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [])

  // Load genres
  useEffect(() => {
    void resolveGenreNames([]).catch(() => { /* noop */ })
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
    } catch {
      setError('Failed to load movies from TMDB.')
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
    try {
      const enriched = await getEnrichedMovieDetail(movie.id)
      setEnrichedDetail(enriched)
    } catch {
      setError('Failed to load movie details.')
    } finally {
      setIsLoadingDetail(false)
    }
  }

  function handleConfirmSelection() {
    if (enrichedDetail) {
      onSelect(enrichedDetail)
    }
  }

  function handleBackToList() {
    setSelectedMovie(null)
    setEnrichedDetail(null)
  }

  return (
    <div className="modal-backdrop blurred" onClick={onClose} style={{ overflowY: 'auto', zIndex: 60 }}>
      <div
        className="ticket-modal movie-picker-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="movie-picker-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">
          <X size={20} strokeWidth={2.5} />
        </button>

        {!selectedMovie ? (
          <>
            {/* LIST VIEW */}
            <div className="movie-picker-header">
              <div className="movie-picker-title-row">
                <Film size={24} strokeWidth={2.5} />
                <h2 id="movie-picker-title">Select a Movie</h2>
              </div>
              <p className="movie-picker-subtitle">Browse TMDB's catalog to pick a movie for your event.</p>
            </div>

            <div className="movie-picker-controls">
              <div className="movie-picker-search">
                <Search size={18} strokeWidth={2.5} />
                <input
                  type="text"
                  placeholder="Search movies..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                />
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

            {error && (
              <div className="auth-notice error" style={{ marginBottom: 16 }}>
                <p>{error}</p>
              </div>
            )}

            {isLoading ? (
              <div className="movie-picker-loading">
                <LoaderCircle className="spin" size={32} strokeWidth={2.5} />
                <p>Loading movies...</p>
              </div>
            ) : movies.length === 0 ? (
              <div className="movie-picker-loading">
                <Film size={32} strokeWidth={2.5} />
                <p>No movies found.</p>
              </div>
            ) : (
              <div className="movie-picker-grid">
                {movies.map((movie) => (
                  <button
                    className="movie-picker-card"
                    key={movie.id}
                    type="button"
                    onClick={() => handleMovieClick(movie)}
                  >
                    <div className="movie-picker-card-poster">
                      {movie.poster_path ? (
                        <img
                          src={tmdbImageUrl(movie.poster_path, 'w342')}
                          alt={movie.title}
                          loading="lazy"
                        />
                      ) : (
                        <div className="movie-picker-card-no-poster">
                          <Clapperboard size={32} />
                        </div>
                      )}
                      <div className="movie-picker-card-rating">
                        <Star size={12} strokeWidth={2.5} />
                        <span>{movie.vote_average.toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="movie-picker-card-info">
                      <h3>{movie.title}</h3>
                      <span className="movie-picker-card-year">
                        {movie.release_date?.slice(0, 4) || 'TBA'}
                      </span>
                      <span className="movie-picker-card-genres">
                        {movie.genre_ids
                          .slice(0, 2)
                          .map((id) => genreMap[id] ?? '')
                          .filter(Boolean)
                          .join(' · ') || 'Movie'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {!isLoading && totalPages > 1 && (
              <div className="movie-picker-pagination">
                <button
                  className="secondary-button compact-button"
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft size={18} strokeWidth={2.5} />
                  Previous
                </button>
                <span className="movie-picker-page-info">
                  Page {page} of {totalPages}
                </span>
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
          </>
        ) : (
          <>
            {/* DETAIL VIEW */}
            <div className="movie-picker-detail">
              <button
                className="secondary-button compact-button"
                type="button"
                onClick={handleBackToList}
                style={{ marginBottom: 16 }}
              >
                <ChevronLeft size={18} strokeWidth={2.5} />
                Back to list
              </button>

              {isLoadingDetail ? (
                <div className="movie-picker-loading">
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

                    <button
                      className="primary-button compact-button"
                      type="button"
                      onClick={handleConfirmSelection}
                      style={{ marginTop: 16 }}
                    >
                      <Clapperboard size={18} strokeWidth={2.5} />
                      Select this movie
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
