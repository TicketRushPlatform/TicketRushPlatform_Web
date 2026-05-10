import { Bell, CheckCheck, CheckCircle2, Info, AlertTriangle, LoaderCircle, Ticket, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  ApiError,
  listNotificationsApi,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  deleteNotificationApi,
  deleteAllNotificationsApi,
  type NotificationItem,
} from '../services/userApi'

export function NotificationsPage() {
  const auth = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!auth.tokens?.access_token) {
        setIsLoading(false)
        return
      }
      try {
        const items = await listNotificationsApi(auth.tokens.access_token)
        if (cancelled) return
        setNotifications(items)
      } catch (err) {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Unable to load notifications.')
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth.tokens?.access_token])

  async function onMarkRead(id: string) {
    if (!auth.tokens?.access_token) return
    try {
      await markNotificationReadApi(auth.tokens.access_token, id)
      setNotifications((current) => current.map((item) => (item.id === id ? { ...item, read: true } : item)))
    } catch {
      // silently fail
    }
  }

  async function onMarkAllRead() {
    if (!auth.tokens?.access_token) return
    try {
      await markAllNotificationsReadApi(auth.tokens.access_token)
      setNotifications((current) => current.map((item) => ({ ...item, read: true })))
    } catch {
      // silently fail
    }
  }

  async function onDelete(id: string) {
    if (!auth.tokens?.access_token) return
    try {
      await deleteNotificationApi(auth.tokens.access_token, id)
      setNotifications((current) => current.filter((item) => item.id !== id))
    } catch {
      // silently fail
    }
  }

  async function onDeleteAll() {
    if (!auth.tokens?.access_token) return
    try {
      await deleteAllNotificationsApi(auth.tokens.access_token)
      setNotifications([])
    } catch {
      // silently fail
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  function toneIcon(tone: string) {
    switch (tone) {
      case 'SUCCESS':
        return <CheckCircle2 size={22} />
      case 'WARNING':
        return <AlertTriangle size={22} />
      default:
        return <Info size={22} />
    }
  }

  return (
    <section className="notifications-page" aria-labelledby="notifications-title">
      <div className="admin-hero">
        <div>
          <p className="eyebrow">
            <Bell size={18} strokeWidth={2.5} />
            Notifications
          </p>
          <h1 id="notifications-title">Updates that affect your account.</h1>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {unreadCount > 0 && (
            <button className="secondary-button compact-button" type="button" onClick={onMarkAllRead}>
              <CheckCheck size={16} strokeWidth={2.5} />
              Mark all read ({unreadCount})
            </button>
          )}
          {notifications.length > 0 && (
            <button className="icon-button danger" type="button" onClick={onDeleteAll} title="Delete all notifications">
              <Trash2 size={16} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="auth-notice error" role="alert">
          <span className="auth-notice-icon">
            <AlertTriangle size={18} strokeWidth={2.5} />
          </span>
          <p>{error}</p>
        </div>
      )}

      {isLoading ? (
        <div className="state-block">
          <LoaderCircle className="spin" size={32} />
          <h2>Loading notifications</h2>
        </div>
      ) : notifications.length === 0 ? (
        <div className="state-block">
          <Ticket size={32} />
          <h2>No notifications yet</h2>
          <p>Role assignments, permission changes, and system alerts will appear here.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((notification) => (
            <article className={notification.read ? 'notification-card read' : 'notification-card'} key={notification.id}>
              <span className="notification-icon">
                {toneIcon(notification.tone)}
              </span>
              <div>
                <h2>{notification.title}</h2>
                <p>{notification.message}</p>
                <time style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)' }}>
                  {new Date(notification.created_at).toLocaleString()}
                </time>
                {notification.link && <Link to={notification.link}>Open</Link>}
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {!notification.read && (
                  <button className="secondary-button compact-button" type="button" onClick={() => onMarkRead(notification.id)}>
                    Mark read
                  </button>
                )}
                <button className="icon-button danger" type="button" onClick={() => onDelete(notification.id)} title="Delete notification">
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
