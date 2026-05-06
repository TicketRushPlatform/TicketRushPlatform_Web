import { ArrowLeft, Circle, Save, Square, Ticket, Triangle } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

type SeatTone = 'vip' | 'reserved' | 'standard' | 'balcony'
type SeatCell = {
  id: string
  row: number
  col: number
  tone: SeatTone
}

const ROWS = 14
const COLS = 18
const tones: Array<{ tone: SeatTone; label: string }> = [
  { tone: 'vip', label: 'VIP' },
  { tone: 'reserved', label: 'Reserved' },
  { tone: 'standard', label: 'Standard' },
  { tone: 'balcony', label: 'Balcony' },
]

export function SeatMapDesignerPage() {
  const containerRef = useRef<HTMLDivElement | null>(null)
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
  const [seatPrices, setSeatPrices] = useState<Record<SeatTone, number>>({
    vip: 180000,
    reserved: 120000,
    standard: 90000,
    balcony: 70000,
  })

  useEffect(() => {
    setSeats((current) => rebuildSeatGrid(rows, cols, current))
  }, [rows, cols])

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

  function applyToneToSelection(tone: SeatTone) {
    if (!selectedSeatIds.length) return
    const selected = new Set(selectedSeatIds)
    setSeats((current) => current.map((seat) => (selected.has(seat.id) ? { ...seat, tone } : seat)))
    setSaveNote(`Updated ${selectedSeatIds.length} seats to ${tone.toUpperCase()}.`)
  }

  function saveMap() {
    setSaveNote(`Seat map saved with ${seats.length} seats.`)
  }

  return (
    <section className="seat-designer-page" aria-labelledby="seat-designer-title">
      <div className="seat-designer-topbar">
        <div>
          <p className="eyebrow">
            <Ticket size={18} strokeWidth={2.5} />
            Seat map studio
          </p>
          <h1 id="seat-designer-title">Design a custom venue map.</h1>
        </div>
        <Link className="secondary-button compact-link" to="/admin/events/new">
          <ArrowLeft size={18} strokeWidth={2.5} />
          Back to create event
        </Link>
      </div>

      <div className="seat-designer-layout">
        <aside className="admin-panel seat-designer-sidebar">
          <h2>Seat type brush</h2>
          <p>Drag to select an area. Releasing mouse applies the selected seat type automatically.</p>
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
            <button className="primary-button compact-button" type="button" onClick={saveMap}>
              Save map
              <span>
                <Save size={16} strokeWidth={2.5} />
              </span>
            </button>
            <p>Current brush: {brushTone.toUpperCase()}</p>
            <p>Current brush price: {new Intl.NumberFormat('vi-VN').format(seatPrices[brushTone])} VND</p>
          </div>
        </aside>

        <section className="admin-panel seat-designer-canvas-panel">
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
                style={{ gridTemplateColumns: `56px repeat(${cols}, ${seatSize}px)` }}
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

function rebuildSeatGrid(rows: number, cols: number, current: SeatCell[]) {
  const toneMap = new Map(current.map((seat) => [`${seat.row}-${seat.col}`, seat.tone] as const))
  return Array.from({ length: rows * cols }, (_, index) => {
    const row = Math.floor(index / cols)
    const col = index % cols
    const tone = toneMap.get(`${row}-${col}`) ?? (row < Math.ceil(rows * 0.25) ? 'vip' : row < Math.ceil(rows * 0.5) ? 'reserved' : row < Math.ceil(rows * 0.75) ? 'standard' : 'balcony')
    return { id: `${toSeatRowLabel(row)}-${col + 1}`, row, col, tone }
  })
}
