import { ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <section className="state-page">
      <div className="state-block">
        <div className="state-icon">
          <ShieldAlert size={34} strokeWidth={2.5} />
        </div>
        <h1>Admin access required</h1>
        <p>Your account is signed in, but it does not have permission to open the TicketRush admin console.</p>
        <Link className="primary-button compact-button" to="/profile">
          Back to profile
        </Link>
      </div>
    </section>
  )
}
