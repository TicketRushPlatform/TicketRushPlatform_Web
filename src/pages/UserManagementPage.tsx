import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'

type MockUser = {
  id: string
  full_name: string
  email: string
  role: 'admin' | 'user'
  status: 'active' | 'banned' | 'suspended'
  avatar_url: string | null
  created_at: string
}

const initialMockUsers: MockUser[] = [
  { id: 'u1', full_name: 'Admin TicketRush', email: 'admin@ticketrush.local', role: 'admin', status: 'active', avatar_url: null, created_at: '2025-01-15' },
  { id: 'u2', full_name: 'Nguyễn Văn An', email: 'an.nguyen@example.com', role: 'user', status: 'active', avatar_url: null, created_at: '2025-02-20' },
  { id: 'u3', full_name: 'Trần Thị Bình', email: 'binh.tran@example.com', role: 'user', status: 'active', avatar_url: null, created_at: '2025-03-05' },
  { id: 'u4', full_name: 'Lê Hoàng Cường', email: 'cuong.le@example.com', role: 'user', status: 'suspended', avatar_url: null, created_at: '2025-03-12' },
  { id: 'u5', full_name: 'Phạm Minh Duy', email: 'duy.pham@example.com', role: 'user', status: 'banned', avatar_url: null, created_at: '2025-04-01' },
  { id: 'u6', full_name: 'Hoàng Thị Hà', email: 'ha.hoang@example.com', role: 'user', status: 'active', avatar_url: null, created_at: '2025-04-10' },
  { id: 'u7', full_name: 'Vũ Quốc Khánh', email: 'khanh.vu@example.com', role: 'user', status: 'active', avatar_url: null, created_at: '2025-04-18' },
  { id: 'u8', full_name: 'Đỗ Thanh Lan', email: 'lan.do@example.com', role: 'user', status: 'active', avatar_url: null, created_at: '2025-05-01' },
]

type ModalMode = 'create' | 'edit' | null

export function UserManagementPage() {
  const [users, setUsers] = useState<MockUser[]>(initialMockUsers)
  const [query, setQuery] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingUser, setEditingUser] = useState<MockUser | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formRole, setFormRole] = useState<'admin' | 'user'>('user')
  const [formStatus, setFormStatus] = useState<'active' | 'banned' | 'suspended'>('active')

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return users
    return users.filter((u) => [u.full_name, u.email, u.role, u.status].join(' ').toLowerCase().includes(keyword))
  }, [users, query])

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === 'active').length,
      banned: users.filter((u) => u.status === 'banned').length,
      admins: users.filter((u) => u.role === 'admin').length,
    }),
    [users],
  )

  function openCreateModal() {
    setFormName('')
    setFormEmail('')
    setFormRole('user')
    setFormStatus('active')
    setEditingUser(null)
    setModalMode('create')
  }

  function openEditModal(user: MockUser) {
    setFormName(user.full_name)
    setFormEmail(user.email)
    setFormRole(user.role)
    setFormStatus(user.status)
    setEditingUser(user)
    setModalMode('edit')
  }

  function closeModal() {
    setModalMode(null)
    setEditingUser(null)
  }

  function onSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (modalMode === 'create') {
      const newUser: MockUser = {
        id: `u${Date.now()}`,
        full_name: formName.trim(),
        email: formEmail.trim(),
        role: formRole,
        status: formStatus,
        avatar_url: null,
        created_at: new Date().toISOString().slice(0, 10),
      }
      setUsers((current) => [...current, newUser])
      setNotice({ tone: 'success', text: `User "${formName.trim()}" created successfully.` })
    } else if (modalMode === 'edit' && editingUser) {
      setUsers((current) =>
        current.map((u) =>
          u.id === editingUser.id ? { ...u, full_name: formName.trim(), email: formEmail.trim(), role: formRole, status: formStatus } : u,
        ),
      )
      setNotice({ tone: 'success', text: `User "${formName.trim()}" updated successfully.` })
    }
    closeModal()
    setTimeout(() => setNotice(null), 4000)
  }

  function toggleBan(user: MockUser) {
    const nextStatus = user.status === 'banned' ? 'active' : 'banned'
    setUsers((current) => current.map((u) => (u.id === user.id ? { ...u, status: nextStatus } : u)))
    setNotice({
      tone: 'success',
      text: nextStatus === 'banned' ? `User "${user.full_name}" has been banned.` : `User "${user.full_name}" has been unbanned.`,
    })
    setTimeout(() => setNotice(null), 4000)
  }

  function deleteUser(user: MockUser) {
    setUsers((current) => current.filter((u) => u.id !== user.id))
    setNotice({ tone: 'success', text: `User "${user.full_name}" has been deleted.` })
    setTimeout(() => setNotice(null), 4000)
  }

  return (
    <section className="user-management-page" aria-labelledby="user-mgmt-title">
      <div className="admin-hero">
        <div>
          <p className="eyebrow">
            <UsersRound size={18} strokeWidth={2.5} />
            User Management
          </p>
          <h1 id="user-mgmt-title" style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginTop: 16 }}>
            Manage all platform users.
          </h1>
        </div>
        <button className="primary-button compact-button" type="button" onClick={openCreateModal}>
          New user
          <span>
            <Plus size={18} strokeWidth={2.5} />
          </span>
        </button>
      </div>

      {notice && (
        <div className={`auth-notice ${notice.tone}`} role="status" aria-live="polite">
          <span className="auth-notice-icon">
            {notice.tone === 'success' ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <AlertCircle size={18} strokeWidth={2.5} />}
          </span>
          <p>{notice.text}</p>
        </div>
      )}

      <div className="user-stats-grid">
        <article className="user-stat-card violet">
          <span className="metric-icon">
            <UsersRound size={22} strokeWidth={2.5} />
          </span>
          <p>Total users</p>
          <strong>{stats.total}</strong>
        </article>
        <article className="user-stat-card mint">
          <span className="metric-icon" style={{ background: 'var(--quaternary)' }}>
            <CheckCircle2 size={22} strokeWidth={2.5} />
          </span>
          <p>Active</p>
          <strong>{stats.active}</strong>
        </article>
        <article className="user-stat-card pink">
          <span className="metric-icon" style={{ background: 'var(--secondary)' }}>
            <Ban size={22} strokeWidth={2.5} />
          </span>
          <p>Banned</p>
          <strong>{stats.banned}</strong>
        </article>
        <article className="user-stat-card amber">
          <span className="metric-icon" style={{ background: 'var(--tertiary)' }}>
            <ShieldCheck size={22} strokeWidth={2.5} />
          </span>
          <p>Admins</p>
          <strong>{stats.admins}</strong>
        </article>
      </div>

      <section className="admin-panel" aria-labelledby="user-table-title">
        <div className="panel-heading">
          <div>
            <h2 id="user-table-title">User directory</h2>
            <p>View, edit, ban, or remove users from the platform.</p>
          </div>
          <div className="table-search">
            <Search size={18} strokeWidth={2.5} />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users" aria-label="Search users" />
          </div>
        </div>

        <div className="user-table" role="table" aria-label="User directory">
          <div className="user-table-row user-table-head" role="row">
            <span role="columnheader" />
            <span role="columnheader">Name</span>
            <span role="columnheader">Email</span>
            <span role="columnheader">Role</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>
          {filteredUsers.map((user) => (
            <div className="user-table-row" role="row" key={user.id}>
              <div className="user-avatar-cell" role="cell">
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <UserRound size={18} strokeWidth={2.5} />}
              </div>
              <span role="cell">{user.full_name}</span>
              <span role="cell" style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                {user.email}
              </span>
              <span role="cell">
                <span className={`user-status-badge ${user.role === 'admin' ? 'active' : ''}`}>{user.role}</span>
              </span>
              <span role="cell">
                <span className={`user-status-badge ${user.status}`}>{user.status}</span>
              </span>
              <div className="user-action-buttons" role="cell">
                <button type="button" title="Edit user" onClick={() => openEditModal(user)}>
                  <Edit3 size={14} strokeWidth={2.5} />
                </button>
                <button type="button" title={user.status === 'banned' ? 'Unban user' : 'Ban user'} onClick={() => toggleBan(user)}>
                  <Ban size={14} strokeWidth={2.5} />
                </button>
                <button className="danger" type="button" title="Delete user" onClick={() => deleteUser(user)}>
                  <Trash2 size={14} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {modalMode && (
        <div className="user-modal-overlay" onClick={closeModal}>
          <form
            className="user-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmitForm}
          >
            <div className="user-modal-header">
              <h2>{modalMode === 'create' ? 'Create new user' : 'Edit user'}</h2>
              <button className="icon-button" type="button" onClick={closeModal} style={{ width: 40, minHeight: 40 }}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            <label className="field">
              <span>Full name</span>
              <input type="text" placeholder="Enter full name" value={formName} onChange={(e) => setFormName(e.target.value)} required />
            </label>

            <label className="field">
              <span>Email</span>
              <input type="email" placeholder="user@example.com" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} required />
            </label>

            <label className="field">
              <span>Role</span>
              <select value={formRole} onChange={(e) => setFormRole(e.target.value as 'admin' | 'user')}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </label>

            <label className="field">
              <span>Status</span>
              <select value={formStatus} onChange={(e) => setFormStatus(e.target.value as 'active' | 'banned' | 'suspended')}>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
                <option value="banned">Banned</option>
              </select>
            </label>

            <div className="user-modal-actions">
              <button className="secondary-button" type="button" onClick={closeModal} style={{ justifyContent: 'center' }}>
                Cancel
              </button>
              <button className="primary-button compact-button" type="submit">
                {modalMode === 'create' ? 'Create user' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  )
}
