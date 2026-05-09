import { AlertCircle, CheckCircle2, KeyRound, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  ApiError,
  createRoleWithPermissions,
  deleteRole,
  listPermissionCatalog,
  listRolePermissions,
  updateRolePermissions,
  type RolePermissionSet,
} from '../services/userApi'

export function PermissionManagementPage() {
  const auth = useAuth()
  const [roles, setRoles] = useState<RolePermissionSet[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; text: string } | null>(null)
  const [newRoleName, setNewRoleName] = useState('')
  const [permissionCatalog, setPermissionCatalog] = useState<string[]>([])
  const [newRolePermissions, setNewRolePermissions] = useState<string[]>([])
  const [selectedRole, setSelectedRole] = useState<string>('')
  const [permissionDrafts, setPermissionDrafts] = useState<Record<string, string>>({})

  const totalPermissions = useMemo(
    () => roles.reduce((sum, role) => sum + role.permissions.length, 0),
    [roles],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      if (!auth.tokens?.access_token) {
        setIsLoading(false)
        return
      }
      try {
        const [response, catalog] = await Promise.all([
          listRolePermissions(auth.tokens.access_token),
          listPermissionCatalog(auth.tokens.access_token),
        ])
        if (cancelled) return
        setRoles(response)
        setPermissionCatalog(catalog)
        if (response.length > 0) setSelectedRole(response[0].name)
      } catch (err) {
        if (cancelled) return
        setNotice({
          tone: 'error',
          text: err instanceof ApiError ? err.message : 'Unable to load roles.',
        })
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [auth.tokens?.access_token])

  function setRoleDraft(name: string, value: string) {
    setPermissionDrafts((current) => ({ ...current, [name]: value }))
  }

  async function onCreateRole() {
    if (!auth.tokens?.access_token || !newRoleName.trim()) return
    try {
      const created = await createRoleWithPermissions(auth.tokens.access_token, {
        name: newRoleName.trim().toUpperCase(),
        permissions: newRolePermissions,
      })
      setRoles((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewRoleName('')
      setNewRolePermissions([])
      setSelectedRole(created.name)
      setNotice({ tone: 'success', text: `Role "${created.name}" created.` })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Unable to create role.' })
    }
  }

  async function onDeleteRole(role: RolePermissionSet) {
    if (!auth.tokens?.access_token || role.system) return
    try {
      await deleteRole(auth.tokens.access_token, role.name)
      setRoles((current) => current.filter((item) => item.name !== role.name))
      setNotice({ tone: 'success', text: `Role "${role.name}" deleted.` })
      if (selectedRole === role.name) setSelectedRole('')
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Unable to delete role.' })
    }
  }

  async function onAddPermission(role: RolePermissionSet) {
    if (!auth.tokens?.access_token) return
    const draft = (permissionDrafts[role.name] ?? '').trim().toUpperCase()
    if (!draft) return
    try {
      const updated = await updateRolePermissions(auth.tokens.access_token, role.name, { permissions_add: [draft] })
      setRoles((current) => current.map((item) => (item.name === role.name ? updated : item)))
      setRoleDraft(role.name, '')
      setNotice({ tone: 'success', text: `Permission added to "${role.name}".` })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Unable to add permission.' })
    }
  }

  async function onRemovePermission(role: RolePermissionSet, permission: string) {
    if (!auth.tokens?.access_token) return
    try {
      const updated = await updateRolePermissions(auth.tokens.access_token, role.name, { permissions_remove: [permission] })
      setRoles((current) => current.map((item) => (item.name === role.name ? updated : item)))
      setNotice({ tone: 'success', text: `Permission removed from "${role.name}".` })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Unable to remove permission.' })
    }
  }

  return (
    <section className="user-management-page permission-page" aria-labelledby="permission-mgmt-title">
      <div className="admin-hero">
        <div>
          <p className="eyebrow">
            <KeyRound size={18} strokeWidth={2.5} />
            Permissions
          </p>
          <h1 id="permission-mgmt-title" style={{ fontSize: 'clamp(2rem, 4vw, 3.4rem)', marginTop: 16 }}>
            Manage role permissions
          </h1>
        </div>
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
          <p>Roles</p>
          <strong>{roles.length}</strong>
        </article>
        <article className="user-stat-card amber">
          <p>Total permissions</p>
          <strong>{totalPermissions}</strong>
        </article>
      </div>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Create new role</h2>
            <p>Add a role and select initial permissions from catalog.</p>
          </div>
        </div>
        <div className="permission-create-grid">
          <label className="field">
            <span>Role name</span>
            <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="e.g. MODERATOR" />
          </label>
          <label className="field permission-catalog-field">
            <span>Initial permissions</span>
            <div className="permission-catalog">
              {permissionCatalog.map((permission) => (
                <button
                  key={permission}
                  type="button"
                  className={newRolePermissions.includes(permission) ? 'chip active' : 'chip'}
                  onClick={() =>
                    setNewRolePermissions((current) =>
                      current.includes(permission) ? current.filter((item) => item !== permission) : [...current, permission],
                    )
                  }
                >
                  {permission}
                </button>
              ))}
            </div>
          </label>
          <button className="primary-button compact-button permission-create-button" type="button" onClick={onCreateRole}>
            Create role
            <span>
              <Plus size={16} strokeWidth={2.5} />
            </span>
          </button>
        </div>
      </section>

      <section className="admin-panel">
        <div className="panel-heading">
          <div>
            <h2>Role permission matrix</h2>
            <p>Add/remove permissions for each role.</p>
          </div>
        </div>
        {isLoading ? (
          <p>Loading roles...</p>
        ) : (
          <div className="permission-role-list">
            {roles.map((role) => (
              <article key={role.name} className={selectedRole === role.name ? 'permission-role-card active' : 'permission-role-card'}>
                <div className="permission-role-header">
                  <div>
                    <strong className="permission-role-name">{role.name}</strong>
                    <p className="permission-role-meta">
                      {role.system ? 'System role' : 'Custom role'} - {role.permissions.length} permissions
                    </p>
                  </div>
                  {!role.system && (
                    <button className="icon-button danger" type="button" onClick={() => onDeleteRole(role)} title="Delete role">
                      <Trash2 size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>

                <div className="permission-chip-list">
                  {role.permissions.map((permission) => (
                    <span className="chip active permission-chip" key={permission}>
                      {permission}
                      <button
                        type="button"
                        onClick={() => onRemovePermission(role, permission)}
                        className="permission-chip-remove"
                        title="Remove permission"
                      >
                        <X size={12} strokeWidth={2.5} />
                      </button>
                    </span>
                  ))}
                </div>

                <div className="permission-role-actions">
                  <select
                    value={permissionDrafts[role.name] ?? ''}
                    onChange={(e) => setRoleDraft(role.name, e.target.value)}
                    className="permission-select"
                  >
                    <option value="">Select permission to add</option>
                    {permissionCatalog
                      .filter((permission) => !role.permissions.includes(permission))
                      .map((permission) => (
                        <option key={permission} value={permission}>
                          {permission}
                        </option>
                      ))}
                  </select>
                  <button className="secondary-button compact-button" type="button" onClick={() => onAddPermission(role)}>
                    Add
                  </button>
                  <button className="secondary-button compact-button permission-focus-button" type="button" onClick={() => setSelectedRole(role.name)}>
                    Focus
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  )
}
