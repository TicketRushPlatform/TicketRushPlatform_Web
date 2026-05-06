import { Bell, CheckCircle2, Info, LoaderCircle, Ticket } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { listNotifications, markNotificationRead } from '../services/ticketRushApi'
import type { NotificationItem } from '../types'

export function NotificationsPage() {
  const auth = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const items = await listNotifications(auth.user?.id)
      if (cancelled) return
      setNotifications(items)
      setIsLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [auth.user?.id])

  async function onMarkRead(id: string) {
    await markNotificationRead(id)
    setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
  }

  return (
    <section className="notifications-page" aria-labelledby="notifications-title">
      <div className="admin-hero">
        <div>
          <p className="eyebrow">
            <Bell size={18} strokeWidth={2.5} />
            Notifications
          </p>
          <h1 id="notifications-title">Updates that affect your tickets.</h1>
        </div>
      </div>

      {isLoading ? (
        <div className="state-block">
          <LoaderCircle className="spin" size={32} />
          <h2>Loading notifications</h2>
        </div>
      ) : notifications.length === 0 ? (
        <div className="state-block">
          <Ticket size={32} />
          <h2>No notifications yet</h2>
          <p>Ticket alerts, queue access, and QR ticket updates will appear here.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={notification.read ? 'notification-card read' : 'notification-card'} key={notification.id}>
              <span className="notification-icon">
                {notification.tone === 'SUCCESS' ? <CheckCircle2 size={22} /> : <Info size={22} />}
              </span>
              <div>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
                {notification.link && <Link to={notification.link}>Open</Link>}
              </div>
              {!notification.read && (
                <button className="secondary-button compact-button" type="button" onClick={() => onMarkRead(notification.id)}>
                  Mark read
                </button>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
