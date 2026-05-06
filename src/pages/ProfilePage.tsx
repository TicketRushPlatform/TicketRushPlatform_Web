import { AlertCircle, ArrowRight, Bell, CheckCircle2, ChevronDown, LogOut, ShieldCheck, TicketCheck, UserRound } from 'lucide-react'
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

type ProfileGender = 'male' | 'female' | 'other' | ''
type ProfileNoticeTone = 'success' | 'error' | 'info'
type ProfileNotice = {
  tone: ProfileNoticeTone
  text: string
}

export function ProfilePage() {
  const auth = useAuth()
  const [fullName, setFullName] = useState(auth.user?.full_name ?? '')
  const [avatarUrl, setAvatarUrl] = useState(auth.user?.avatar_url ?? '')
  const [gender, setGender] = useState<ProfileGender>((auth.user?.gender as ProfileGender | null) ?? '')
  const [age, setAge] = useState(auth.user?.age ? String(auth.user.age) : '')
  const [address, setAddress] = useState(auth.user?.address ?? '')
  const [phoneNumber, setPhoneNumber] = useState(auth.user?.phone_number ?? '')
  const [bio, setBio] = useState(auth.user?.bio ?? '')
  const [selectedAvatarFile, setSelectedAvatarFile] = useState<File | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [notice, setNotice] = useState<ProfileNotice | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  function onPickAvatar() {
    fileInputRef.current?.click()
  }

  function onAvatarSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setNotice({ tone: 'error', text: 'Please choose an image file (jpg, png, webp, ...).' })
      event.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setAvatarUrl(reader.result)
        setSelectedAvatarFile(file)
        setNotice({ tone: 'info', text: 'Avatar selected. Click Save profile to upload to system storage.' })
      }
    }
    reader.readAsDataURL(file)
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setIsSaving(true)
    setNotice(null)
    try {
      let nextAvatarUrl = avatarUrl.trim() || null
      if (selectedAvatarFile) {
        nextAvatarUrl = await auth.uploadMedia({ file: selectedAvatarFile, kind: 'avatar' })
      }
      await auth.updateProfile({
        full_name: fullName.trim(),
        avatar_url: nextAvatarUrl,
        gender: (gender || null) as 'male' | 'female' | 'other' | null,
        age: age.trim() ? Number(age.trim()) : null,
        address: address.trim() || null,
        phone_number: phoneNumber.trim() || null,
        bio: bio.trim() || null,
      })
      setSelectedAvatarFile(null)
      setAvatarUrl(nextAvatarUrl ?? '')
      setNotice({ tone: 'success', text: 'Profile saved successfully. Your account settings are now up to date.' })
    } catch (error) {
      const fallback = 'Could not save profile right now. Please verify your input and try again.'
      const message = error instanceof Error && error.message ? error.message : fallback
      setNotice({ tone: 'error', text: message })
    } finally {
      setIsSaving(false)
    }
  }

  if (!auth.user) return null

  return (
    <section className="profile-page" aria-labelledby="profile-title">
      <div className="profile-hero">
        <button className="profile-avatar-large avatar-picker-button" type="button" onClick={onPickAvatar}>
          {avatarUrl ? <img src={avatarUrl} alt="" /> : <UserRound size={56} />}
          <span className="avatar-picker-hint">Change photo</span>
        </button>
        <div className="profile-hero-copy">
          <p className="eyebrow">
            <UserRound size={18} strokeWidth={2.5} />
            Account settings
          </p>
          <h1 id="profile-title">{auth.user.full_name}</h1>
          <p className="hero-text">{auth.user.email} · {auth.user.role}</p>
        </div>
      </div>

      <div className="profile-grid">
        <form className="admin-card profile-form" onSubmit={onSubmit}>
          <h2>Profile details</h2>
          <label className="field">
            <span>Full name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} />
          </label>
          <div className="profile-form-row">
            <label className="field">
              <span>Gender</span>
              <GenderSelect value={gender} onChange={setGender} />
            </label>
            <label className="field">
              <span>Age</span>
              <input type="number" min={1} max={120} value={age} onChange={(event) => setAge(event.target.value)} />
            </label>
          </div>
          <label className="field">
            <span>Phone number</span>
            <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} placeholder="+84..." />
          </label>
          <label className="field">
            <span>Address</span>
            <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="District, City" />
          </label>
          <label className="field">
            <span>Bio</span>
            <textarea rows={4} value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Tell us a bit about you..." />
          </label>
          <input ref={fileInputRef} type="file" accept="image/*" className="visually-hidden-input" onChange={onAvatarSelected} />
          <p className="helper-text">Click the avatar to choose a new image.</p>
          {notice && (
            <div className={`auth-notice ${notice.tone}`} role="status" aria-live="polite">
              <span className="auth-notice-icon">
                {notice.tone === 'success' ? <CheckCircle2 size={18} strokeWidth={2.5} /> : <AlertCircle size={18} strokeWidth={2.5} />}
              </span>
              <p>{notice.text}</p>
            </div>
          )}
          <button className="primary-button" type="submit" disabled={isSaving}>
            {isSaving ? 'Saving...' : 'Save profile'}
            <span>
              <ArrowRight size={18} strokeWidth={2.5} />
            </span>
          </button>
        </form>

        <aside className="admin-card profile-actions-card">
          <h2>Workspace</h2>
          <Link className="secondary-button" to="/tickets">
            <TicketCheck size={18} strokeWidth={2.5} />
            My Tickets
          </Link>
          <Link className="secondary-button" to="/notifications">
            <Bell size={18} strokeWidth={2.5} />
            Notifications
          </Link>
          {auth.isAdmin && (
            <Link className="primary-button" to="/admin">
              Open Admin
              <span>
                <ShieldCheck size={18} strokeWidth={2.5} />
              </span>
            </Link>
          )}
          <button className="secondary-button danger-button" type="button" onClick={auth.signOut}>
            <LogOut size={18} strokeWidth={2.5} />
            Sign out
          </button>
        </aside>
      </div>
    </section>
  )
}

function GenderSelect({ value, onChange }: { value: ProfileGender; onChange: (value: ProfileGender) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement | null>(null)
  const options: Array<{ value: ProfileGender; label: string }> = [
    { value: '', label: 'Prefer not to say' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
    { value: 'other', label: 'Other' },
  ]
  const label = options.find((option) => option.value === value)?.label ?? 'Prefer not to say'

  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setIsOpen(false)
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
        aria-label="Select gender"
        onClick={() => setIsOpen((open) => !open)}
      >
        <span>{label}</span>
        <ChevronDown size={18} strokeWidth={2.5} />
      </button>
      {isOpen && (
        <div className="filter-select-menu" role="listbox" aria-label="Gender options">
          {options.map((option) => (
            <button
              className={option.value === value ? 'filter-option active' : 'filter-option'}
              key={option.label}
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
