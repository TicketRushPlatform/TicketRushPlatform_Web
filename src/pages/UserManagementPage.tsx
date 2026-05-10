import {
  AlertCircle,
  Ban,
  ChevronDown,
  CheckCircle2,
  Edit3,
  Plus,
  Search,
  Trash2,
  UserRound,
  UsersRound,
  X,
  KeyRound,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  ApiError,
  assignUserRole,
  createUserByAdmin,
  deleteUserByAdmin,
  listRolePermissions,
  listUsers,
  removeUserRole,
  updateUserByAdmin,
  type RolePermissionSet,
  type User,
} from '../services/userApi'

type ModalMode = 'create' | 'edit' | 'roles' | null

export function UserManagementPage() {
  const auth = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [query, setQuery] = useState('')
  const [modalMode, setModalMode] = useState<ModalMode>(null)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [availableRoles, setAvailableRoles] = useState<RolePermissionSet[]>([])

  const [formRole, setFormRole] = useState('USER')
  const [formStatus, setFormStatus] = useState<'ACTIVE' | 'BLOCKED'>('ACTIVE')

  // Role assignment state
  const [selectedRoleToAssign, setSelectedRoleToAssign] = useState('')
  const [isAssigning, setIsAssigning] = useState(false)

  const filteredUsers = useMemo(() => {
    const keyword = query.trim().toLowerCase()
    if (!keyword) return users
    return users.filter((u) =>
      [u.full_name, u.email, u.role, u.status, ...(u.assigned_roles ?? [])].join(' ').toLowerCase().includes(keyword),
    )
  }, [users, query])

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((u) => u.status === 'ACTIVE').length,
      banned: users.filter((u) => u.status === 'BLOCKED').length,
      withRoles: users.filter((u) => (u.assigned_roles?.length ?? 0) > 0).length,
    }),
    [users],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!auth.tokens?.access_token) {
        setIsLoading(false)
        return
      }
      try {
        const [fetchedUsers, fetchedRoles] = await Promise.all([
          listUsers(auth.tokens.access_token),
          listRolePermissions(auth.tokens.access_token),
        ])
        if (!cancelled) {
          setUsers(fetchedUsers)
          setAvailableRoles(fetchedRoles)

        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof ApiError ? err.message : 'Unable to load users.'
          setNotice({ tone: 'error', text: message })
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth.tokens?.access_token])

  function openCreateModal() {
    setFormName('')
    setFormEmail('')
    setFormPassword('')
    setFormRole('USER')
    setFormStatus('ACTIVE')
    setEditingUser(null)
    setModalMode('create')
  }

  function openEditModal(user: User) {
    setFormName(user.full_name)
    setFormEmail(user.email ?? '')
    setFormPassword('')
    setFormRole(user.role?.toUpperCase() ?? 'USER')
    setFormStatus((user.status?.toUpperCase() === 'BLOCKED' ? 'BLOCKED' : 'ACTIVE') as 'ACTIVE' | 'BLOCKED')
    setEditingUser(user)
    setModalMode('edit')
  }

  function openRolesModal(user: User) {
    setEditingUser(user)
    setSelectedRoleToAssign('')
    setModalMode('roles')
  }

  function closeModal() {
    setModalMode(null)
    setEditingUser(null)
  }

  async function onSubmitForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!modalMode || modalMode === 'roles' || !auth.tokens?.access_token) return
    setIsSubmitting(true)
    try {
      if (modalMode === 'create') {
        const created = await createUserByAdmin(auth.tokens.access_token, {
          email: formEmail.trim(),
          password: formPassword,
          full_name: formName.trim(),
          role: formRole,
          status: formStatus,
        })
        setUsers((current) => [created, ...current])
        setNotice({ tone: 'success', text: `User "${created.full_name}" created successfully.` })
      } else if (editingUser) {
        const updated = await updateUserByAdmin(auth.tokens.access_token, editingUser.id, {
          full_name: formName.trim(),
          role: formRole,
          status: formStatus,
        })
        setUsers((current) => current.map((u) => (u.id === editingUser.id ? updated : u)))
        setNotice({ tone: 'success', text: `User "${updated.full_name}" updated successfully.` })
      }
      closeModal()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : modalMode === 'create' ? 'Unable to create user.' : 'Unable to update user.'
      setNotice({ tone: 'error', text: message })
    } finally {
      setIsSubmitting(false)
      setTimeout(() => setNotice(null), 4000)
    }
  }

  async function onAssignRole() {
    if (!auth.tokens?.access_token || !editingUser || !selectedRoleToAssign) return
    setIsAssigning(true)
    try {
      await assignUserRole(auth.tokens.access_token, editingUser.id, selectedRoleToAssign)

      // Refresh user data to get updated assigned_roles
      const updatedUsers = await listUsers(auth.tokens.access_token)
      setUsers(updatedUsers)
      const updatedUser = updatedUsers.find((u) => u.id === editingUser.id)
      if (updatedUser) setEditingUser(updatedUser)

      setSelectedRoleToAssign('')
      setNotice({ tone: 'success', text: `Role "${selectedRoleToAssign}" assigned to "${editingUser.full_name}". User has been notified.` })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to assign role.'
      setNotice({ tone: 'error', text: message })
    } finally {
      setIsAssigning(false)
      setTimeout(() => setNotice(null), 5000)
    }
  }

  async function onRemoveRole(roleName: string) {
    if (!auth.tokens?.access_token || !editingUser) return
    try {
      await removeUserRole(auth.tokens.access_token, editingUser.id, roleName)

      // Refresh user data
      const updatedUsers = await listUsers(auth.tokens.access_token)
      setUsers(updatedUsers)
      const updatedUser = updatedUsers.find((u) => u.id === editingUser.id)
      if (updatedUser) setEditingUser(updatedUser)

      setNotice({ tone: 'success', text: `Role "${roleName}" removed from "${editingUser.full_name}". User has been notified.` })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to remove role.'
      setNotice({ tone: 'error', text: message })
    }
    setTimeout(() => setNotice(null), 5000)
  }

  async function toggleBan(user: User) {
    if (!auth.tokens?.access_token) return
    try {
      const nextStatus = user.status === 'BLOCKED' ? 'ACTIVE' : 'BLOCKED'
      const updated = await updateUserByAdmin(auth.tokens.access_token, user.id, { status: nextStatus })
      setUsers((current) => current.map((u) => (u.id === user.id ? updated : u)))
      setNotice({
        tone: 'success',
        text: nextStatus === 'BLOCKED' ? `User "${user.full_name}" has been banned.` : `User "${user.full_name}" has been unbanned.`,
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to update user status.'
      setNotice({ tone: 'error', text: message })
    }
    setTimeout(() => setNotice(null), 4000)
  }

  async function deleteUser(user: User) {
    if (!auth.tokens?.access_token) return
    try {
      await deleteUserByAdmin(auth.tokens.access_token, user.id)
      setUsers((current) => current.filter((u) => u.id !== user.id))
      setNotice({ tone: 'success', text: `User "${user.full_name}" has been deleted.` })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Unable to delete user.'
      setNotice({ tone: 'error', text: message })
    }
    setTimeout(() => setNotice(null), 4000)
  }

  // Roles not yet assigned to the editing user
  const unassignedRoles = useMemo(() => {
    if (!editingUser) return availableRoles
    const assignedSet = new Set(editingUser.assigned_roles ?? [])
    return availableRoles.filter((r) => !assignedSet.has(r.name))
  }, [editingUser, availableRoles])

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
            <KeyRound size={22} strokeWidth={2.5} />
          </span>
          <p>With roles</p>
          <strong>{stats.withRoles}</strong>
        </article>
      </div>

      <section className="admin-panel" aria-labelledby="user-table-title">
        <div className="panel-heading">
          <div>
            <h2 id="user-table-title">User directory</h2>
            <p>View, edit, ban, assign roles, or remove users from the platform.</p>
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
            <span role="columnheader">Roles</span>
            <span role="columnheader">Status</span>
            <span role="columnheader">Actions</span>
          </div>
          {isLoading ? (
            <div className="user-table-row" role="row">
              <span role="cell" />
              <span role="cell">Loading users...</span>
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
              <span role="cell" />
            </div>
          ) : filteredUsers.map((user) => (
            <div className="user-table-row" role="row" key={user.id}>
              <div className="user-avatar-cell" role="cell">
                {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <UserRound size={18} strokeWidth={2.5} />}
              </div>
              <span role="cell">{user.full_name}</span>
              <span role="cell" style={{ color: 'var(--muted-foreground)', fontSize: '0.9rem' }}>
                {user.email}
              </span>
              <span role="cell">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <span className={`user-status-badge ${user.role === 'ADMIN' ? 'active' : ''}`}>{user.role}</span>
                  {(user.assigned_roles ?? []).map((roleName) => (
                    <span className="user-status-badge" key={roleName} style={{ background: 'var(--tertiary)', color: '#000' }}>
                      {roleName}
                    </span>
                  ))}
                </div>
              </span>
              <span role="cell">
                <span className={`user-status-badge ${user.status === 'BLOCKED' ? 'banned' : 'active'}`}>{user.status}</span>
              </span>
              <div className="user-action-buttons" role="cell">
                <button type="button" title="Edit user" onClick={() => openEditModal(user)}>
                  <Edit3 size={14} strokeWidth={2.5} />
                </button>
                <button type="button" title="Manage roles" onClick={() => openRolesModal(user)}>
                  <KeyRound size={14} strokeWidth={2.5} />
                </button>
                <button type="button" title={user.status === 'BLOCKED' ? 'Unban user' : 'Ban user'} onClick={() => toggleBan(user)}>
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

      {/* Create / Edit modal */}
      {(modalMode === 'create' || modalMode === 'edit') && (
        <div className="user-modal-overlay" onClick={closeModal}>
          <form
            className="user-modal"
            onClick={(e) => e.stopPropagation()}
            onSubmit={onSubmitForm}
          >
            <div className="user-modal-header">
              <h2>{modalMode === 'create' ? 'Create user' : 'Edit user'}</h2>
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
              <input
                type="email"
                placeholder="user@example.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                disabled={modalMode === 'edit'}
              />
            </label>

            {modalMode === 'create' && (
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  placeholder="At least 8 characters"
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
            )}

            {modalMode === 'create' && (
              <label className="field">
                <span>Base role</span>
                <OptionPicker
                  value={formRole}
                  valueLabel={formRole}
                  ariaLabel="Choose role"
                  options={[
                    { value: 'USER', label: 'USER' },
                    { value: 'ADMIN', label: 'ADMIN' },
                  ]}
                  onChange={(value) => setFormRole(value)}
                />
              </label>
            )}

            <label className="field">
              <span>Status</span>
              <OptionPicker
                value={formStatus}
                valueLabel={formStatus}
                ariaLabel="Choose status"
                options={[
                  { value: 'ACTIVE', label: 'ACTIVE' },
                  { value: 'BLOCKED', label: 'BLOCKED' },
                ]}
                onChange={(value) => setFormStatus(value as 'ACTIVE' | 'BLOCKED')}
              />
            </label>

            <div className="user-modal-actions">
              <button className="secondary-button" type="button" onClick={closeModal} style={{ justifyContent: 'center' }}>
                Cancel
              </button>
              <button className="primary-button compact-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create user' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Role Assignment modal */}
      {modalMode === 'roles' && editingUser && (
        <div className="user-modal-overlay" onClick={closeModal}>
          <div className="user-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 580 }}>
            <div className="user-modal-header">
              <h2>
                <KeyRound size={20} strokeWidth={2.5} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
                Manage roles for {editingUser.full_name}
              </h2>
              <button className="icon-button" type="button" onClick={closeModal} style={{ width: 40, minHeight: 40 }}>
                <X size={18} strokeWidth={2.5} />
              </button>
            </div>

            {/* Currently assigned roles */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 10, color: 'var(--muted-foreground)' }}>Assigned roles</h3>
              {(editingUser.assigned_roles ?? []).length === 0 ? (
                <p style={{ fontSize: '0.9rem', color: 'var(--muted-foreground)', fontStyle: 'italic' }}>No dynamic roles assigned yet.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(editingUser.assigned_roles ?? []).map((roleName) => {
                    const roleDef = availableRoles.find((r) => r.name === roleName)
                    return (
                      <div
                        key={roleName}
                        style={{
                          background: 'var(--card)',
                          border: '1px solid var(--border)',
                          borderRadius: 12,
                          padding: '10px 14px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 6,
                          minWidth: 180,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                          <strong style={{ fontSize: '0.9rem' }}>{roleName}</strong>
                          <button
                            className="icon-button danger"
                            type="button"
                            title={`Remove ${roleName}`}
                            onClick={() => onRemoveRole(roleName)}
                            style={{ width: 28, minHeight: 28, padding: 4 }}
                          >
                            <X size={14} strokeWidth={2.5} />
                          </button>
                        </div>
                        {roleDef && roleDef.permissions.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {roleDef.permissions.map((perm) => (
                              <span
                                key={perm}
                                style={{
                                  background: 'var(--accent)',
                                  color: 'var(--accent-foreground)',
                                  borderRadius: 6,
                                  padding: '2px 8px',
                                  fontSize: '0.75rem',
                                  fontWeight: 500,
                                }}
                              >
                                {perm}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Assign new role */}
            {unassignedRoles.length > 0 && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                <h3 style={{ fontSize: '0.95rem', marginBottom: 10, color: 'var(--muted-foreground)' }}>Assign a new role</h3>
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <select
                      value={selectedRoleToAssign}
                      onChange={(e) => setSelectedRoleToAssign(e.target.value)}
                      className="permission-select"
                      style={{ width: '100%' }}
                    >
                      <option value="">Select a role to assign</option>
                      {unassignedRoles.map((role) => (
                        <option key={role.name} value={role.name}>
                          {role.name} ({role.permissions.length} permissions)
                        </option>
                      ))}
                    </select>
                    {selectedRoleToAssign && (
                      <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {availableRoles
                          .find((r) => r.name === selectedRoleToAssign)
                          ?.permissions.map((perm) => (
                            <span
                              key={perm}
                              style={{
                                background: 'var(--tertiary)',
                                color: '#000',
                                borderRadius: 6,
                                padding: '2px 8px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                              }}
                            >
                              {perm}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                  <button
                    className="primary-button compact-button"
                    type="button"
                    onClick={onAssignRole}
                    disabled={!selectedRoleToAssign || isAssigning}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {isAssigning ? 'Assigning...' : 'Assign role'}
                    <span>
                      <Plus size={16} strokeWidth={2.5} />
                    </span>
                  </button>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--muted-foreground)', marginTop: 8 }}>
                  The user will receive a notification about their new role and permissions.
                </p>
              </div>
            )}

            <div className="user-modal-actions" style={{ marginTop: 20 }}>
              <button className="secondary-button" type="button" onClick={closeModal} style={{ justifyContent: 'center' }}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

function OptionPicker({
  value,
  valueLabel,
  options,
  ariaLabel,
  onChange,
}: {
  value: string
  valueLabel: string
  options: Array<{ value: string; label: string }>
  ariaLabel: string
  onChange: (value: string) => void
}) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setIsOpen(false)
    }
    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  return (
    <div className={isOpen ? 'filter-select open' : 'filter-select'} ref={wrapperRef}>
      <button
        className="filter-select-trigger"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{valueLabel}</span>
        <ChevronDown size={18} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="filter-select-menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              className={option.value === value ? 'filter-option active' : 'filter-option'}
              key={option.value}
              type="button"
              onClick={() => {
                onChange(option.value)
                setIsOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
