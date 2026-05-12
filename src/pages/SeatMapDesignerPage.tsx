import { ArrowLeft, Circle, Columns3, LayoutGrid, Map as MapIcon, RefreshCw, Rows3, Save, Square, Ticket, Triangle, X } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { createSeatMap, fetchSeatMaps } from '../services/ticketRushApi'
import type { SeatClass, SeatSectionInput } from '../types'

type SeatTone = 'vip' | 'reserved' | 'standard' | 'balcony'
type SeatCell = {
  id: string
  row: number
  col: number
  tone: SeatTone
}

type ApiSeatMap = {
  id: string
  name: string
  venue_id?: string
  venue_name: string
  venue_address: string
  seats?: Array<{
    id: string
    row: string
    number: number
    seat_class: SeatClass
    price: number
  }>
}

export type SavedSeatMap = {
  id: string
  name: string
  venue: string
  address: string
  rows: number
  cols: number
  sections: SeatSectionInput[]
  seats: Array<{ row: number; col: number; tone: SeatTone }>
}

const SEAT_MAPS_STORAGE_KEY = 'ticketrush.seat_maps.v1'

export function loadSavedSeatMaps(): SavedSeatMap[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SEAT_MAPS_STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SavedSeatMap[]
  } catch {
    return []
  }
}

function saveSeatMapsToStorage(maps: SavedSeatMap[]): void {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SEAT_MAPS_STORAGE_KEY, JSON.stringify(maps))
}

const ROWS = 14
const COLS = 18
const tones: Array<{ tone: SeatTone; label: string }> = [
  { tone: 'vip', label: 'VIP' },
  { tone: 'reserved', label: 'Reserved' },
  { tone: 'standard', label: 'Standard' },
  { tone: 'balcony', label: 'Balcony' },
]

const toneToSeatClass: Record<SeatTone, SeatClass> = {
  vip: 'VIP',
  reserved: 'PREMIUM',
  standard: 'STANDARD',
  balcony: 'STANDARD',
}

const seatClassToTone: Record<SeatClass, SeatTone> = {
  DELUXE: 'vip',
  VIP: 'vip',
  PREMIUM: 'reserved',
  STANDARD: 'standard',
}

function buildSectionsFromSeats(seats: SeatCell[], cols: number, prices: Record<SeatTone, number>): SeatSectionInput[] {
  // Group rows by their dominant tone
  const rowTones = new Map<number, SeatTone>()
  for (const seat of seats) {
    // Count tones per row
    if (!rowTones.has(seat.row)) {
      rowTones.set(seat.row, seat.tone)
    }
  }

  const sections: SeatSectionInput[] = []
  let currentTone: SeatTone | null = null
  let currentRowCount = 0

  const sortedRows = [...rowTones.entries()].sort((a, b) => a[0] - b[0])
  for (const [, tone] of sortedRows) {
    if (tone !== currentTone) {
      if (currentTone !== null) {
        sections.push({
          name: currentTone.charAt(0).toUpperCase() + currentTone.slice(1),
          rowCount: currentRowCount,
          seatsPerRow: cols,
          seatClass: toneToSeatClass[currentTone],
          price: prices[currentTone],
        })
      }
      currentTone = tone
      currentRowCount = 1
    } else {
      currentRowCount++
    }
  }

  if (currentTone !== null) {
    sections.push({
      name: currentTone.charAt(0).toUpperCase() + currentTone.slice(1),
      rowCount: currentRowCount,
      seatsPerRow: cols,
      seatClass: toneToSeatClass[currentTone],
      price: prices[currentTone],
    })
  }

  return sections.length ? sections : [{ name: 'Default', rowCount: ROWS, seatsPerRow: COLS, seatClass: 'STANDARD', price: 90000 }]
}

export function SeatMapDesignerPage({ asModal, onClose, onSave }: { asModal?: boolean; onClose?: () => void; onSave?: (savedMap: SavedSeatMap) => void }) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [mapName, setMapName] = useState('')
  const [mapVenue, setMapVenue] = useState('')
  const [mapAddress, setMapAddress] = useState('')
  const [rows, setRows] = useState(ROWS)
  const [cols, setCols] = useState(COLS)
  const [seatSize, setSeatSize] = useState(26)
  const [seats, setSeats] = useState<SeatCell[]>(() =>
    Array.from({ length: ROWS * COLS }, (_, index) => {
      const row = Math.floor(index / COLS)
      const col = index % COLS
      const tone: SeatTone = row < 3 ? 'vip' : row < 7 ? 'reserved' : row < 11 ? 'standard' : 'balcony'
      return { id: `${toSeatRowLabel(row)}-${col + 1}`, row, col, tone }
    }),
  )
  const [brushTone, setBrushTone] = useState<SeatTone>('vip')
  const [dragStart, setDragStart] = useState<{ row: number; col: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ row: number; col: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [saveNote, setSaveNote] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [existingSeatMaps, setExistingSeatMaps] = useState<SavedSeatMap[]>([])
  const [selectedMapId, setSelectedMapId] = useState<string | null>(null)
  const [isLoadingMaps, setIsLoadingMaps] = useState(false)
  const [seatMapsError, setSeatMapsError] = useState<string | null>(null)
  const [seatPrices, setSeatPrices] = useState<Record<SeatTone, number>>({
    vip: 180000,
    reserved: 120000,
    standard: 90000,
    balcony: 70000,
  })

  useEffect(() => {
    if (!asModal) return
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [asModal])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSeats((current) => rebuildSeatGrid(rows, cols, current))
  }, [rows, cols])

  useEffect(() => {
    void refreshExistingSeatMaps()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    function computeSeatSize() {
      const container = containerRef.current
      if (!container) return
      const width = container.clientWidth - 24
      const height = 560
      const maxByWidth = Math.floor((width - cols * 3) / cols)
      const maxByHeight = Math.floor((height - rows * 3) / rows)
      setSeatSize(Math.max(6, Math.min(34, maxByWidth, maxByHeight)))
    }
    computeSeatSize()
    const observer = new ResizeObserver(computeSeatSize)
    if (containerRef.current) observer.observe(containerRef.current)
    window.addEventListener('resize', computeSeatSize)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', computeSeatSize)
    }
  }, [cols, rows])
  const selectedSeatIds = useMemo(() => {
    if (!dragStart || !dragCurrent) return []
    const minRow = Math.min(dragStart.row, dragCurrent.row)
    const maxRow = Math.max(dragStart.row, dragCurrent.row)
    const minCol = Math.min(dragStart.col, dragCurrent.col)
    const maxCol = Math.max(dragStart.col, dragCurrent.col)
    return seats
      .filter((seat) => seat.row >= minRow && seat.row <= maxRow && seat.col >= minCol && seat.col <= maxCol)
      .map((seat) => seat.id)
  }, [dragCurrent, dragStart, seats])
  const seatLookup = useMemo(() => new Map(seats.map((seat) => [`${seat.row}-${seat.col}`, seat])), [seats])
  const currentSummary = useMemo(() => buildSeatSummary(seats), [seats])
  const currentSeatCount = seats.length

  function applyToneToSelection(tone: SeatTone) {
    if (!selectedSeatIds.length) return
    const selected = new Set(selectedSeatIds)
    setSeats((current) => current.map((seat) => (selected.has(seat.id) ? { ...seat, tone } : seat)))
    setSaveNote(`Updated ${selectedSeatIds.length} seats to ${tone.toUpperCase()}.`)
  }

  async function createSeatMapViaApi(payload: {
    name: string
    venue: string
    address: string
    seats: Array<{ row: string; number: number; seat_class: SeatClass; price: number }>
  }): Promise<SavedSeatMap> {
    const item = await createSeatMap(payload)
    return {
      id: item.id,
      name: item.name,
      venue: item.venue_name,
      address: item.venue_address,
      rows,
      cols,
      sections: buildSectionsFromSeats(seats, cols, seatPrices),
      seats: seats.map((s) => ({ row: s.row, col: s.col, tone: s.tone })),
    }
  }

  async function fetchSeatMapsViaApi(): Promise<SavedSeatMap[]> {
    const items = await fetchSeatMaps()
    return items.map(normalizeApiSeatMap)
  }

  async function refreshExistingSeatMaps() {
    setIsLoadingMaps(true)
    setSeatMapsError(null)
    try {
      const apiMaps = await fetchSeatMapsViaApi()
      const localMaps = loadSavedSeatMaps()
      const merged = mergeSeatMaps(apiMaps, localMaps)
      setExistingSeatMaps(merged)
    } catch (error) {
      const localMaps = loadSavedSeatMaps()
      setExistingSeatMaps(localMaps)
      setSeatMapsError(error instanceof Error ? error.message : 'Unable to load existing seat maps.')
    } finally {
      setIsLoadingMaps(false)
    }
  }

  function loadSeatMap(map: SavedSeatMap) {
    setSelectedMapId(map.id)
    setMapName(map.name)
    setMapVenue(map.venue)
    setMapAddress(map.address)
    setRows(map.rows)
    setCols(map.cols)
    setSeats(rebuildSeatGrid(map.rows, map.cols, map.seats.map((seat) => ({ ...seat, id: `${toSeatRowLabel(seat.row)}-${seat.col + 1}` }))))
    setDragStart(null)
    setDragCurrent(null)
    setSaveNote(`Loaded "${map.name}".`)
  }

  function startNewMap() {
    setSelectedMapId(null)
    setMapName('')
    setMapVenue('')
    setMapAddress('')
    setRows(ROWS)
    setCols(COLS)
    setSeats(rebuildSeatGrid(ROWS, COLS, []))
    setDragStart(null)
    setDragCurrent(null)
    setSaveNote(null)
  }

  async function saveMap() {
    if (isSaving) return
    const name = mapName.trim() || `Seat Map ${new Date().toLocaleTimeString()}`
    const sections = buildSectionsFromSeats(seats, cols, seatPrices)
    const seatData = seats.map((s) => ({ row: s.row, col: s.col, tone: s.tone }))
    setIsSaving(true)
    setSaveNote(null)

    try {
      const venue = mapVenue.trim() || 'Custom Venue'
      const address = mapAddress.trim() || 'Custom Address'
      const savedMap = await createSeatMapViaApi({
        name,
        venue,
        address,
        seats: seats.map((seat) => ({
          row: toSeatRowLabel(seat.row),
          number: seat.col + 1,
          seat_class: toneToSeatClass[seat.tone],
          price: seatPrices[seat.tone],
        })),
      })

      const newMap: SavedSeatMap = {
        ...savedMap,
        venue,
        address,
        rows,
        cols,
        sections,
        seats: seatData,
      }

      const existing = loadSavedSeatMaps()
      const savedMaps = [...existing.filter((item) => item.id !== newMap.id), newMap]
      saveSeatMapsToStorage(savedMaps)
      setExistingSeatMaps((current) => mergeSeatMaps([newMap], current))
      setSelectedMapId(newMap.id)
      setSaveNote(`Seat map "${name}" saved with ${seats.length} seats.`)

      if (onSave) {
        onSave(newMap)
      } else if (onClose) {
        onClose()
      }
    } catch (error) {
      setSaveNote(error instanceof Error ? error.message : 'Failed to save seat map via backend API.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={asModal ? "modal-body-container" : "seat-designer-page"} aria-labelledby="seat-designer-title" style={asModal ? { position: 'relative' } : undefined}>
      {asModal && (
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal" style={{ zIndex: 10 }}>
          <X size={20} strokeWidth={2.5} />
        </button>
      )}
      {!asModal && (
        <div className="seat-designer-topbar">
          <div>
            <p className="eyebrow">
              <Ticket size={18} strokeWidth={2.5} />
              Seat map studio
            </p>
            <h1 id="seat-designer-title">Venue seat maps</h1>
          </div>
          <Link className="secondary-button compact-link" to="/admin/events/new">
            <ArrowLeft size={18} strokeWidth={2.5} />
            Back to create event
          </Link>
        </div>
      )}

      <div className="seat-designer-layout">
        <aside className="admin-panel seat-map-library-panel">
          <div className="seat-map-panel-heading">
            <div>
              <span className="seat-map-panel-kicker">Library</span>
              <h2>Existing maps</h2>
            </div>
            <button className="tiny-icon-button" type="button" onClick={refreshExistingSeatMaps} aria-label="Refresh seat maps" disabled={isLoadingMaps}>
              <RefreshCw size={18} strokeWidth={2.5} />
            </button>
          </div>

          <button className="seat-map-new-button" type="button" onClick={startNewMap}>
            <span>
              <MapIcon size={18} strokeWidth={2.5} />
            </span>
            New seat map
          </button>

          {seatMapsError && <p className="designer-note warning">{seatMapsError}</p>}

          <div className="seat-map-library-list" aria-busy={isLoadingMaps}>
            {isLoadingMaps && (
              <div className="seat-map-empty-state">
                <RefreshCw size={18} strokeWidth={2.5} />
                Loading maps
              </div>
            )}
            {!isLoadingMaps && existingSeatMaps.length === 0 && (
              <div className="seat-map-empty-state">
                <LayoutGrid size={18} strokeWidth={2.5} />
                No seat maps yet
              </div>
            )}
            {!isLoadingMaps && existingSeatMaps.map((map) => {
              const summary = summarizeSavedMap(map)
              return (
                <button
                  className={`seat-map-library-card ${selectedMapId === map.id ? 'active' : ''}`}
                  type="button"
                  key={map.id}
                  onClick={() => loadSeatMap(map)}
                >
                  <strong>{map.name}</strong>
                  <span>{map.venue || 'Venue TBA'}</span>
                  <span>{map.rows} rows x {map.cols} columns</span>
                  <div className="seat-map-mini-preview" style={{ gridTemplateColumns: `repeat(${Math.min(map.cols, 18)}, 1fr)` }}>
                    {buildMiniPreviewSeats(map).map((seat, index) => (
                      <i className={seat.tone} key={`${map.id}-${index}`} />
                    ))}
                  </div>
                  <small>{summary.total.toLocaleString()} seats</small>
                </button>
              )
            })}
          </div>
        </aside>

        <section className="admin-panel seat-designer-canvas-panel">
          <div className="seat-map-canvas-toolbar">
            <div>
              <span className="seat-map-panel-kicker">Canvas</span>
              <h2>{mapName.trim() || 'Untitled map'}</h2>
            </div>
            <div className="seat-map-stats-row" aria-label="Current seat map stats">
              <span><Rows3 size={16} strokeWidth={2.5} /> {rows}</span>
              <span><Columns3 size={16} strokeWidth={2.5} /> {cols}</span>
              <span><Ticket size={16} strokeWidth={2.5} /> {currentSeatCount.toLocaleString()}</span>
            </div>
          </div>
          <div
            ref={containerRef}
            className="seat-map-paint-canvas"
            onMouseUp={() => {
              setIsDragging(false)
              applyToneToSelection(brushTone)
            }}
            onMouseLeave={() => setIsDragging(false)}
          >
            <div className="seat-map-paint-stage">Stage</div>
            <div className="seat-map-paint-scroll">
              <div
                className="seat-map-paint-grid-with-headers"
                style={{ gridTemplateColumns: `48px repeat(${cols}, ${seatSize}px)` }}
              >
                <div className="seat-grid-corner" />
                {Array.from({ length: cols }, (_, index) => (
                  <div className="seat-grid-col-header" key={`col-${index + 1}`}>
                    {index + 1}
                  </div>
                ))}
                {Array.from({ length: rows }, (_, rowIndex) => (
                  <Fragment key={`row-group-${rowIndex}`}>
                    <div className="seat-grid-row-header" key={`row-${rowIndex}`}>
                      {toSeatRowLabel(rowIndex)}
                    </div>
                    {Array.from({ length: cols }, (_, colIndex) => {
                      const seat = seatLookup.get(`${rowIndex}-${colIndex}`)
                      if (!seat) return <div key={`empty-${rowIndex}-${colIndex}`} />
                      const isSelected = selectedSeatIds.includes(seat.id)
                      return (
                        <button
                          className={`seat-map-paint-seat ${seat.tone} ${isSelected ? 'selected' : ''}`}
                          key={seat.id}
                          type="button"
                          style={{ width: `${seatSize}px`, minHeight: `${seatSize}px` }}
                          aria-label={`${toSeatRowLabel(seat.row)}${seat.col + 1} ${seat.tone}`}
                          onMouseDown={() => {
                            setIsDragging(true)
                            setDragStart({ row: seat.row, col: seat.col })
                            setDragCurrent({ row: seat.row, col: seat.col })
                          }}
                          onMouseEnter={() => {
                            if (!dragStart || !isDragging) return
                            setDragCurrent({ row: seat.row, col: seat.col })
                          }}
                          onMouseUp={() => {
                            setIsDragging(false)
                            setDragCurrent({ row: seat.row, col: seat.col })
                            applyToneToSelection(brushTone)
                          }}
                        />
                      )
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </section>

        <aside className="admin-panel seat-designer-sidebar">
          <h2>Map details</h2>
          <label className="field">
            <span>Map name *</span>
            <input
              type="text"
              placeholder="e.g. Main Hall, Screen 1..."
              value={mapName}
              onChange={(e) => setMapName(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Venue</span>
            <input
              type="text"
              placeholder="e.g. TicketRush Arena"
              value={mapVenue}
              onChange={(e) => setMapVenue(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Address</span>
            <input
              type="text"
              placeholder="e.g. District 1, HCMC"
              value={mapAddress}
              onChange={(e) => setMapAddress(e.target.value)}
            />
          </label>

          <div className="seat-map-dimensions">
            <label className="field">
              <span>Rows</span>
              <input
                type="number"
                min={1}
                max={120}
                value={rows}
                onChange={(event) => setRows(Math.max(1, Math.min(120, Number(event.target.value) || 1)))}
              />
            </label>
            <label className="field">
              <span>Columns</span>
              <input
                type="number"
                min={1}
                max={120}
                value={cols}
                onChange={(event) => setCols(Math.max(1, Math.min(120, Number(event.target.value) || 1)))}
              />
            </label>
          </div>

          <div className="seat-map-summary-grid">
            {tones.map((item) => (
              <span className={item.tone} key={item.tone}>
                <i />
                {currentSummary[item.tone]}
              </span>
            ))}
          </div>

          <h3>Seat brush</h3>
          <div className="custom-seat-library seat-tone-tools">
            {tones.map((item) => (
              <div key={item.tone} className={`library-seat-pill ${item.tone} ${brushTone === item.tone ? 'active' : ''}`}>
                <button className="seat-brush-button" type="button" onClick={() => setBrushTone(item.tone)}>
                  <strong>{item.label}</strong>
                  <span className="seat-brush-icon">
                    {item.tone === 'vip' && <Circle size={18} strokeWidth={2.5} />}
                    {item.tone === 'reserved' && <Square size={18} strokeWidth={2.5} />}
                    {item.tone === 'standard' && <Triangle size={18} strokeWidth={2.5} />}
                    {item.tone === 'balcony' && <Ticket size={18} strokeWidth={2.5} />}
                  </span>
                </button>
                <label className="seat-price-input">
                  Price
                  <input
                    type="number"
                    min={0}
                    value={seatPrices[item.tone]}
                    onChange={(event) =>
                      setSeatPrices((current) => ({
                        ...current,
                        [item.tone]: Math.max(0, Number(event.target.value) || 0),
                      }))
                    }
                  />
                </label>
              </div>
            ))}
          </div>

          <div className="designer-inspector">
            <h3>Selection</h3>
            {saveNote && <p className="designer-note">{saveNote}</p>}
            <p>{selectedSeatIds.length} seats selected</p>
            <button className="secondary-button" type="button" onClick={() => { setDragStart(null); setDragCurrent(null) }} disabled={!selectedSeatIds.length}>
              Clear selection
            </button>
            <button className="primary-button compact-button" type="button" onClick={saveMap} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save map'}
              <span>
                <Save size={16} strokeWidth={2.5} />
              </span>
            </button>
            {asModal && (
              <button className="secondary-button" type="button" onClick={onClose} style={{ marginTop: 8 }}>
                Cancel
              </button>
            )}
            <p style={{ marginTop: 16 }}>Current brush: {brushTone.toUpperCase()}</p>
            <p>Current brush price: {new Intl.NumberFormat('vi-VN').format(seatPrices[brushTone])} VND</p>
          </div>
        </aside>
      </div>
    </section>
  )
}

function toSeatRowLabel(index: number) {
  let value = index + 1
  let result = ''
  while (value > 0) {
    const remainder = (value - 1) % 26
    result = String.fromCharCode(65 + remainder) + result
    value = Math.floor((value - 1) / 26)
  }
  return result
}

function fromSeatRowLabel(label: string) {
  const normalized = label.trim().toUpperCase()
  if (!normalized) return 0
  let value = 0
  for (const char of normalized) {
    const code = char.charCodeAt(0)
    if (code < 65 || code > 90) continue
    value = value * 26 + (code - 64)
  }
  return Math.max(0, value - 1)
}

function rebuildSeatGrid(rows: number, cols: number, current: SeatCell[]) {
  const toneMap = new Map(current.map((seat) => [`${seat.row}-${seat.col}`, seat.tone] as const))
  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const tone = toneMap.get(`${row}-${col}`) ?? (row < Math.ceil(rows * 0.25) ? 'vip' : row < Math.ceil(rows * 0.5) ? 'reserved' : row < Math.ceil(rows * 0.75) ? 'standard' : 'balcony')
    return { id: `${toSeatRowLabel(row)}-${col + 1}`, row, col, tone }
  })
}

function normalizeApiSeatMap(item: ApiSeatMap): SavedSeatMap {
  const apiSeats = item.seats ?? []
  const rowIndexes = apiSeats.map((seat) => fromSeatRowLabel(seat.row))
  const maxRow = rowIndexes.length ? Math.max(...rowIndexes) : ROWS - 1
  const maxCol = apiSeats.length ? Math.max(...apiSeats.map((seat) => seat.number)) : COLS
  const rows = Math.max(1, maxRow + 1)
  const cols = Math.max(1, maxCol)
  const seats = apiSeats.map((seat) => {
    const row = fromSeatRowLabel(seat.row)
    const col = Math.max(0, seat.number - 1)
    return {
      id: seat.id || `${toSeatRowLabel(row)}-${col + 1}`,
      row,
      col,
      tone: seatClassToTone[seat.seat_class] ?? 'standard',
    }
  })
  const completeSeats = rebuildSeatGrid(rows, cols, seats)
  return {
    id: item.id,
    name: item.name,
    venue: item.venue_name,
    address: item.venue_address,
    rows,
    cols,
    sections: buildSectionsFromSeats(completeSeats, cols, {
      vip: 180000,
      reserved: 120000,
      standard: 90000,
      balcony: 70000,
    }),
    seats: completeSeats.map((seat) => ({ row: seat.row, col: seat.col, tone: seat.tone })),
  }
}

function mergeSeatMaps(primary: SavedSeatMap[], secondary: SavedSeatMap[]) {
  const byID = new Map<string, SavedSeatMap>()
  for (const map of secondary) byID.set(map.id, map)
  for (const map of primary) byID.set(map.id, map)
  return [...byID.values()].sort((a, b) => a.name.localeCompare(b.name))
}

function buildSeatSummary(seats: SeatCell[]) {
  return seats.reduce<Record<SeatTone, number>>(
    (summary, seat) => {
      summary[seat.tone] += 1
      return summary
    },
    { vip: 0, reserved: 0, standard: 0, balcony: 0 },
  )
}

function summarizeSavedMap(map: SavedSeatMap) {
  return {
    total: map.rows * map.cols,
  }
}

function buildMiniPreviewSeats(map: SavedSeatMap) {
  const maxRows = Math.min(map.rows, 6)
  const maxCols = Math.min(map.cols, 18)
  const lookup = new Map(map.seats.map((seat) => [`${seat.row}-${seat.col}`, seat.tone] as const))
  return Array.from({ length: maxRows * maxCols }, (_, index) => {
    const row = Math.floor(index / maxCols)
    const col = index % maxCols
    return { tone: lookup.get(`${row}-${col}`) ?? 'standard' }
  })
}
