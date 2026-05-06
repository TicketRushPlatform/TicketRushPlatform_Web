import { ArrowRight, LoaderCircle, Mic, MicOff, Music2, Radio, RotateCcw, Ticket } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatDate, recognizeHummedSong } from '../services/ticketRushApi'
import type { SoundSearchResult } from '../types'

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'denied' | 'unsupported'

export function SoundSearchPage() {
  const [recorderState, setRecorderState] = useState<RecorderState>('idle')
  const [secondsLeft, setSecondsLeft] = useState(15)
  const [results, setResults] = useState<SoundSearchResult[]>([])
  const [bars, setBars] = useState<number[]>(() => Array.from({ length: 28 }, (_, index) => 24 + ((index * 17) % 58)))
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)

  const stateCopy = useMemo(() => {
    if (recorderState === 'recording') return { title: 'Listening to your melody', text: 'Hum or sing the movie soundtrack for up to 15 seconds.' }
    if (recorderState === 'processing') return { title: 'Matching soundtrack', text: 'TicketRush is comparing the audio contour against the movie soundtrack catalog.' }
    if (recorderState === 'done') return { title: 'Movies found', text: 'These results use a backend-ready mock adapter with confidence scores.' }
    if (recorderState === 'denied') return { title: 'Microphone blocked', text: 'Allow microphone access or try again in a browser profile with permission enabled.' }
    if (recorderState === 'unsupported') return { title: 'Recorder unavailable', text: 'This browser does not support MediaRecorder for microphone capture.' }
    return { title: 'Find a movie by humming', text: 'Press record, hum a soundtrack, then jump straight to the matching movie showtime.' }
  }, [recorderState])

  useEffect(() => {
    if (recorderState !== 'recording') return

    const timer = window.setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          stopRecording()
          return 0
        }
        return current - 1
      })
      setBars((current) => current.map((value, index) => 18 + ((value + index * 13) % 72)))
    }, 1000)

    return () => window.clearInterval(timer)
  }, [recorderState])

  async function startRecording() {
    if (!('MediaRecorder' in window) || !navigator.mediaDevices?.getUserMedia) {
      setRecorderState('unsupported')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      setResults([])
      setSecondsLeft(15)

      const recorder = new MediaRecorder(stream)
      mediaRecorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        void processRecording()
      }
      recorder.start()
      setRecorderState('recording')
    } catch {
      setRecorderState('denied')
    }
  }

  function stopRecording() {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.stop()
    }
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  async function processRecording() {
    setRecorderState('processing')
    const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
    const matches = await recognizeHummedSong(blob)
    setResults(matches)
    setRecorderState('done')
  }

  function reset() {
    stopRecording()
    chunksRef.current = []
    setResults([])
    setSecondsLeft(15)
    setRecorderState('idle')
  }

  return (
    <section className="sound-search-page" aria-labelledby="sound-search-title">
      <div className="sound-hero">
        <div>
          <p className="eyebrow">
            <Music2 size={18} strokeWidth={2.5} />
            Soundtrack Discovery
          </p>
          <h1 id="sound-search-title">Hum a tune. Find the movie.</h1>
          <p className="hero-text">{stateCopy.text}</p>
        </div>

        <div className={`recorder-panel ${recorderState}`}>
          <div className="record-ring">
            {recorderState === 'recording' ? <Radio size={46} /> : recorderState === 'denied' ? <MicOff size={46} /> : <Mic size={46} />}
          </div>
          <h2>{stateCopy.title}</h2>
          <strong>{recorderState === 'recording' ? `${secondsLeft}s` : '15s'}</strong>
          <div className="waveform" aria-hidden="true">
            {bars.map((bar, index) => (
              <span key={index} style={{ height: `${bar}%` }} />
            ))}
          </div>
          <div className="recorder-actions">
            {recorderState === 'recording' ? (
              <button className="primary-button" type="button" onClick={stopRecording}>
                Stop and match
                <span>
                  <ArrowRight size={18} />
                </span>
              </button>
            ) : recorderState === 'processing' ? (
              <button className="primary-button" type="button" disabled>
                Matching...
                <span>
                  <LoaderCircle className="spin" size={18} />
                </span>
              </button>
            ) : (
              <button className="primary-button" type="button" onClick={startRecording}>
                Start humming
                <span>
                  <Mic size={18} />
                </span>
              </button>
            )}
            <button className="secondary-button compact-button" type="button" onClick={reset}>
              <RotateCcw size={18} />
              Reset
            </button>
          </div>
        </div>
      </div>

      {results.length > 0 && (
        <section className="sound-results" aria-labelledby="sound-results-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">Ranked matches</p>
              <h2 id="sound-results-title">Soundtrack matches</h2>
            </div>
          </div>
          <div className="sound-result-grid">
            {results.map((result) => (
              <article className="sound-result-card" key={result.id}>
                <img src={result.event.imageUrl} alt="" />
                <div>
                  <span className="status-pill">{result.confidence}% match</span>
                  <h3>{result.event.name}</h3>
                  <p>
                    {result.soundtrack.title} by {result.soundtrack.artist}
                  </p>
                  <small>{result.matchedPhrase}</small>
                  <div className="result-meta">
                    <span>{result.nextShowtime ? formatDate(result.event.date) : 'No showtime'}</span>
                    <span>{result.nextShowtime?.screenName ?? result.nextShowtime?.venue}</span>
                  </div>
                  <Link className="primary-button compact-button" to={`/events/${result.event.id}`}>
                    Book Seats
                    <span>
                      <Ticket size={18} />
                    </span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  )
}
