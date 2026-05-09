import { X } from 'lucide-react'
import { useEffect } from 'react'
import { AdminCreateEventPage } from './AdminCreateEventPage'

type CreateEventModalProps = {
  onClose: () => void
  onSuccess: (eventId: string) => void
}

export function CreateEventModal({ onClose, onSuccess }: CreateEventModalProps) {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = originalOverflow
    }
  }, [])

  return (
    <div className="modal-backdrop blurred" onClick={onClose} style={{ overflowY: 'auto' }}>
      <div 
        className="ticket-modal" 
        style={{ gridTemplateColumns: '1fr', width: 'min(100%, 1100px)', padding: '24px', position: 'relative' }} 
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close modal" style={{ zIndex: 10 }}>
          <X size={20} strokeWidth={2.5} />
        </button>
        
        <div style={{ marginBottom: 20 }}>
          <h2 id="modal-title" style={{ fontSize: '1.8rem', marginBottom: 8 }}>Create Event</h2>
          <p style={{ color: 'var(--muted-foreground)' }}>Build the next ticket drop.</p>
        </div>

        <AdminCreateEventPage asModal onSuccess={onSuccess} onClose={onClose} />
      </div>
    </div>
  )
}
