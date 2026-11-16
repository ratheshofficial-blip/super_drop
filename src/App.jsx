import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDownLeft, ArrowLeft, ArrowRight, BadgeCheck, Bell, Check, CheckCircle2,
  ChevronDown, CircleDollarSign, Copy, ExternalLink, Heart, Instagram, Link2,
  LockKeyhole, LogOut, Menu, MessageCircle, Moon, MoreHorizontal, Music2,
  Play, Plus, QrCode, Send, Settings2, Share2, ShieldCheck, Sparkles, Sun,
  TrendingUp, Wallet, X, Youtube,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { creatorFromProfile, formatRupees, getSaved, initialCreator, initialSupporters, save, supporterFromRecord } from './data'
import { supabase, supabaseConfigError } from './supabase'

const requestTypes = ['Shoutout', 'Question', 'Song request']
const presets = [49, 99, 199, 499]
const reservedUsernames = new Set(['admin', 'api', 'dashboard', 'demo', 'login', 'overlay', 'privacy', 'refunds', 'signup', 'terms'])
const badWords = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot']

function useStoredState(key, initialValue) {
  const [value, setValue] = useState(() => getSaved(key, initialValue))
  useEffect(() => save(key, value), [key, value])
  return [value, setValue]
}

function IconButton({ label, children, onClick, className = '' }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick}>{children}</button>
}

function Brand({ compact = false }) {
  return <a className="brand" href="/demo" aria-label="SuperDrop home"><span className="brand-mark"><ArrowDownLeft size={17} strokeWidth={3} /></span>{!compact && <span>superdrop<span className="brand-period">.</span></span>}</a>
}

function Modal({ title, onClose, children, wide = false }) {
  useEffect(() => {
    const handleKey = (event) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="modal-heading"><h2>{title}</h2><IconButton label="Close" onClick={onClose}><X size={19} /></IconButton></div>
      {children}
    </section>
  </div>
}

function Header({ theme, setTheme, onAuth, creator }) {
  const [toast, setToast] = useState('')
  const share = async () => {
    const url = `${location.origin}/${creator.username}`
    try {
      if (navigator.share) await navigator.share({ title: `${creator.name} on SuperDrop`, url })
      else {
        await navigator.clipboard.writeText(url)
        setToast('Link copied to clipboard')
        window.setTimeout(() => setToast(''), 2400)
      }
    } catch (error) {
      if (error?.name !== 'AbortError') {
        setToast('Could not share the link. Copy it from your browser address bar.')
        window.setTimeout(() => setToast(''), 3000)
      }
    }
  }
  return <>
    <header className="topbar">
      <Brand />
      <nav className="top-nav" aria-label="Main navigation">
        <a href="/demo">Discover</a><a href="/dashboard">For creators</a>
      </nav>
      <div className="top-actions">
        <IconButton label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`} onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>{theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}</IconButton>
        <button className="button button-dark top-share" onClick={share}><Share2 size={15} /> Share page</button>
        <a className="login-link" href="/dashboard" onClick={(event) => { event.preventDefault(); onAuth() }}>Creator login <ArrowRight size={14} /></a>
      </div>
    </header>
    {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
  </>
}

function SupportCard({ creator, onSupport }) {
  const [name, setName] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [message, setMessage] = useState('')
  const [amount, setAmount] = useState(99)
  const [customAmount, setCustomAmount] = useState('')
  const [type, setType] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const selectedAmount = amount === 'custom' ? Number(customAmount) : amount

  const submit = (event) => {
    event.preventDefault()
    setError('')
    if (!anonymous && name.trim().length < 2) return setError('Add your name, or choose to stay anonymous.')
    if (!message.trim()) return setError('Write a little note for the creator.')
    if (message.trim().length > 240) return setError('Your message is a little too long.')
    if (!Number.isInteger(selectedAmount) || selectedAmount < 1 || selectedAmount > 100000) return setError('Choose an amount between ₹1 and ₹1,00,000.')
    if (badWords.some((word) => new RegExp(`\\b${word}\\b`, 'i').test(message))) return setError('Please keep your message kind and respectful.')
    setBusy(true)
    window.setTimeout(() => {
      onSupport({ name: anonymous ? 'Anonymous' : name.trim(), amount: selectedAmount, message: message.trim(), type: type || 'Support' })
      setBusy(false)
      setName('')
      setMessage('')
      setType('')
      setAmount(99)
      setCustomAmount('')
    }, 500)
  }

  return <section className="support-card" id="support">
    <div className="support-card-top">
      <div><p className="eyebrow">A little love goes a long way</p><h2>Send a SuperDrop</h2></div>
      <span className="heart-stamp"><Heart size={21} fill="currentColor" /></span>
    </div>
    <form onSubmit={submit}>
      <div className="field-label-row"><label htmlFor="fan-name">Your name</label><label className="check-label"><input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} /> Stay anonymous</label></div>
      {!anonymous && <input id="fan-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} placeholder="What should we call you?" maxLength={40} autoComplete="name" />}
      <label className="input-label" htmlFor="fan-message">Your message <span>Optional request below</span></label>
      <div className="message-box"><textarea id="fan-message" value={message} onChange={(event) => setMessage(event.target.value)} maxLength={240} placeholder="Say something nice, ask a question…" /><span className={message.length > 220 ? 'count count-warn' : 'count'}>{message.length}/240</span></div>
      <label className="input-label amount-label">Choose an amount <span>100% good vibes</span></label>
      <div className="amount-options">
        {presets.map((value) => <button type="button" className={`amount-chip ${amount === value ? 'selected' : ''}`} onClick={() => setAmount(value)} key={value} aria-pressed={amount === value}>₹{value}</button>)}
        <button type="button" className={`amount-chip custom-chip ${amount === 'custom' ? 'selected' : ''}`} onClick={() => setAmount('custom')} aria-pressed={amount === 'custom'}>Custom</button>
      </div>
      {amount === 'custom' && <div className="custom-input-wrap"><span>₹</span><input aria-label="Custom support amount" type="number" min="1" max="100000" step="1" value={customAmount} onChange={(event) => setCustomAmount(event.target.value)} placeholder="Enter amount (max ₹1,00,000)" /></div>}
      <label className="input-label request-label" htmlFor="request-type">Make it a request <span>Optional</span></label>
      <div className="select-wrap"><select id="request-type" value={type} onChange={(event) => setType(event.target.value)}><option value="">Just a little support</option>{requestTypes.map((option) => <option key={option}>{option}</option>)}</select><ChevronDown size={16} /></div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="button button-primary send-button" type="submit" disabled={busy}>{busy ? <span className="spinner" /> : <Heart size={17} fill="currentColor" />}{busy ? 'Getting things ready…' : `Send ${formatRupees(selectedAmount || 0)} of love`}</button>
      <p className="secure-note"><LockKeyhole size={12} /> Secure mock checkout · No real payment is made</p>
    </form>
  </section>
}

function Supporters({ supporters }) {
  return <section className="supporters-section">
    <div className="section-title-row"><div><p className="eyebrow">The lovely people</p><h2>Recent supporters <span className="live-dot" /></h2></div><span className="supporter-total">{supporters.length} drops</span></div>
    <div className="supporter-list">
      {supporters.slice(0, 4).map((supporter, index) => <article className="supporter-row" key={supporter.id}>
        <span className={`supporter-avatar avatar-${index % 4}`}>{supporter.name === 'Anonymous' ? <LockKeyhole size={16} /> : supporter.name.charAt(0).toUpperCase()}</span>
        <div className="supporter-copy"><div className="supporter-meta"><strong>{supporter.name}</strong><span>·</span><time>{supporter.time}</time></div><p>{supporter.message || 'Sent some love your way!'}</p></div>
        <span className="support-amount">{formatRupees(supporter.amount)}</span>
      </article>)}
    </div>
    <div className="supporter-footer"><div className="fan-stack"><span>P</span><span>R</span><span>A</span><span>+2k</span></div><p>Join a community that shows up.</p></div>
  </section>
}

function CreatorPage({ creator, supporters, onSupport, theme, setTheme, onAuth }) {
  const [qrOpen, setQrOpen] = useState(false)
  const [toast, setToast] = useState('')
  const share = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}/${creator.username}`)
      setToast('Creator link copied!')
    } catch {
      setToast('Copy this link from your browser address bar.')
    }
    window.setTimeout(() => setToast(''), 2200)
  }
  return <div className="public-shell">
    <Header theme={theme} setTheme={setTheme} onAuth={onAuth} creator={creator} />
    <main className="creator-layout">
      <section className="creator-main">
        <div className="creator-cover">
          <img src={creator.banner} alt="" />
          <div className="cover-overlay" />
          <span className="cover-caption"><Sparkles size={14} /> LIVE FROM MUMBAI</span>
          <div className="cover-scribble">good things<br />grow together<span>↗</span></div>
        </div>
        <div className="profile-block">
          <div className="profile-main">
            <div className="avatar-wrap"><img className="creator-avatar" src={creator.avatar} alt={`${creator.name} profile`} /><span className="verified-badge" title="Verified creator"><BadgeCheck size={16} fill="currentColor" /></span></div>
            <div className="creator-details"><div className="creator-name-row"><h1>{creator.name}</h1><span className="verified-text"><BadgeCheck size={14} /> Creator</span></div><p className="creator-handle">@{creator.username} <span>·</span> {creator.tagline}</p></div>
          </div>
          <p className="creator-bio">{creator.bio}</p>
          <div className="profile-bottom">
            <div className="social-links">
              <a href={`https://instagram.com/${creator.instagram}`} target="_blank" rel="noreferrer"><Instagram size={15} /> Instagram</a>
              <a href={`https://youtube.com/@${creator.youtube}`} target="_blank" rel="noreferrer"><Youtube size={16} /> YouTube</a>
              <a href={`https://${creator.website}`} target="_blank" rel="noreferrer"><Link2 size={15} /> Website</a>
            </div>
            <div className="profile-actions"><button className="button button-outline" onClick={share}><Share2 size={15} /> Share</button><button className="button button-outline qr-button" onClick={() => setQrOpen(true)} aria-label="Show QR code"><QrCode size={16} /></button></div>
          </div>
        </div>
        <div className="creator-divider" />
        <Supporters supporters={supporters} />
        <aside className="creator-signoff"><span className="signoff-star">✳</span><div><strong>Made with love, for creators.</strong><p>Every drop helps creators do more of what you love.</p></div><a href="/dashboard">Start your page <ArrowRight size={15} /></a></aside>
      </section>
      <aside className="support-column"><SupportCard creator={creator} onSupport={onSupport} /><div className="payment-footnote"><span><ShieldCheck size={16} /></span><p><strong>Good vibes, safely.</strong><br />No real payment is processed in this demo.</p></div></aside>
    </main>
    <footer className="site-footer"><Brand /><p>Made for the ones who make the internet.</p><nav><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/refunds">Refunds</a></nav><span>© 2026 SuperDrop</span></footer>
    {toast && <div className="toast" role="status"><Check size={15} />{toast}</div>}
    {qrOpen && <Modal title="Share the good stuff" onClose={() => setQrOpen(false)}><div className="qr-content"><p>Scan to visit <strong>superdrop.app/{creator.username}</strong></p><div className="qr-code"><QRCodeSVG value={`${location.origin}/${creator.username}`} size={192} bgColor="#ffffff" fgColor="#171513" level="M" /></div><button className="button button-dark full-button" onClick={share}><Copy size={15} /> Copy page link</button></div></Modal>}
  </div>
}

function PaymentModal({ support, onClose, onPay }) {
  const [step, setStep] = useState('confirm')
  const [error, setError] = useState('')
  const proceed = async () => {
    setError('')
    setStep('processing')
    window.setTimeout(async () => {
      try {
        const saved = await onPay()
        if (saved) setStep('success')
        else setStep('confirm')
      } catch (paymentError) {
        setError(paymentError.message || 'Could not save your support. Please try again.')
        setStep('confirm')
      }
    }, 500)
  }
  return <Modal title={step === 'success' ? 'You made their day!' : 'Mock checkout'} onClose={onClose}>
    {step === 'confirm' && <div className="checkout-content"><div className="checkout-recipient"><img src={support.creator.avatar} alt="" /><span>Sending love to<strong>{support.creator.name}</strong></span><BadgeCheck size={16} /></div><div className="checkout-amount"><span>Your mock support</span><strong>{formatRupees(support.amount)}</strong></div><div className="checkout-message"><span>Your note</span><p>“{support.message || 'Sending you a little love!'}”</p></div><div className="mock-payment-info"><LockKeyhole size={16} /><span>This is a demo. No real money is charged.</span></div>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary full-button" onClick={proceed}><CircleDollarSign size={17} /> Confirm {formatRupees(support.amount)} (demo)</button><button className="cancel-link" onClick={onClose}>Cancel, not now</button></div>}
    {step === 'processing' && <div className="payment-state"><span className="spinner spinner-large" /><h3>Sending good vibes…</h3><p>Just a moment while we make it official.</p></div>}
    {step === 'success' && <div className="payment-state"><span className="success-icon"><CheckCircle2 size={34} /></span><h3>Support sent successfully</h3><p>Your note is on its way to {support.creator.name}. No payment was made.</p><button className="button button-dark full-button" onClick={onClose}>Back to the page</button></div>}
  </Modal>
}

function LoginModal({ onClose, onSignedIn }) {
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [sent, setSent] = useState(false)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const handleOtp = async (event) => {
    event.preventDefault()
    setMessage('')
    if (!email.includes('@')) return setMessage('Enter a valid email address.')
    setBusy(true)
    try {
      if (supabase) {
        const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
        if (error) throw error
        setSent(true)
        setMessage('A sign-in code is on its way. Check your inbox.')
      } else {
        setSent(true)
        setMessage('Demo mode: enter any 6-digit code to continue.')
      }
    } catch (error) {
      setMessage(error.message || 'Could not send your sign-in code.')
    } finally { setBusy(false) }
  }
  const verify = async (event) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) return setMessage('Enter the 6-digit code from your email.')
    setBusy(true)
    try {
      if (supabase) {
        const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'email' })
        if (error) throw error
      } else {
        localStorage.setItem('superdrop-demo-email', email)
      }
      onSignedIn()
    } catch (error) {
      setMessage(error.message || 'That code could not be verified.')
    } finally { setBusy(false) }
  }
  const google = async () => {
    if (!supabase) return setMessage('Add Supabase credentials to enable Google sign-in.')
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/dashboard` } })
    if (error) setMessage(error.message)
  }
  return <Modal title="Your creator space awaits" onClose={onClose}>
    <div className="login-content"><p>Log in to manage your page, messages and earnings.</p>
      {!sent ? <form onSubmit={handleOtp}><label className="input-label" htmlFor="login-email">Email address</label><input id="login-email" type="email" autoComplete="email" className="text-input" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required /><button className="button button-dark full-button login-submit" disabled={busy}>{busy ? 'Sending…' : 'Continue with email'} <ArrowRight size={16} /></button></form>
        : <form onSubmit={verify}><label className="input-label" htmlFor="login-otp">6-digit email code</label><input id="login-otp" inputMode="numeric" autoComplete="one-time-code" className="text-input" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="123456" /><button className="button button-dark full-button login-submit" disabled={busy}>Verify and continue <ArrowRight size={16} /></button><button type="button" className="cancel-link" onClick={() => { setSent(false); setMessage('') }}>Use a different email</button></form>}
      <div className="login-divider"><span />or<span /></div><button className="button button-outline full-button google-button" onClick={google}><span className="google-g">G</span> Continue with Google</button>
      {message && <p className={message.startsWith('A sign-in') || message.startsWith('Demo mode') ? 'inline-success' : 'form-error'} role="status">{message}</p>}
      {!supabase && <p className="demo-hint">Preview mode is active. Email sign-in is simulated.</p>}
    </div>
  </Modal>
}

const menuItems = [
  { id: 'overview', label: 'Overview', icon: TrendingUp },
  { id: 'messages', label: 'Messages', icon: MessageCircle },
  { id: 'profile', label: 'My page', icon: Settings2 },
  { id: 'payouts', label: 'Payouts', icon: Wallet },
  { id: 'overlay', label: 'Live overlay', icon: Play },
]

function Dashboard({ creator, setCreator, supporters, setSupporters, onAuth, authed, onOpenAuth, session }) {
  const [tab, setTab] = useState('overview')
  const [savedMessage, setSavedMessage] = useState('')
  const [reply, setReply] = useState({})
  const [replyOpen, setReplyOpen] = useState({})
  const [messageFilter, setMessageFilter] = useState('all')
  const [error, setError] = useState('')
  const [privateSettings, setPrivateSettings] = useState(() => supabase ? null : getSaved('superdrop-demo-payout-settings', {
    payout_method: 'upi',
    payout_upi_id: '',
    bank_account_holder: '',
    bank_account_number: '',
    bank_ifsc: '',
  }))
  const [earnings, setEarnings] = useState(null)
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [rotatingToken, setRotatingToken] = useState(false)
  const total = supporters.reduce((sum, item) => sum + Number(item.amount), 0)
  const earningsTotal = Number(earnings?.all_time ?? total)
  const visibleSupporters = supporters.filter((item) => messageFilter === 'all' || item.status === messageFilter)
  const overlayUrl = `${location.origin}/overlay/${creator.username}${privateSettings?.overlay_token ? `?token=${privateSettings.overlay_token}` : ''}`

  useEffect(() => {
    if (!supabase || !session) return undefined
    let active = true
    const loadPrivateSettings = async () => {
      const [settingsResult, earningsResult] = await Promise.all([
        supabase.from('creator_private_settings').select('*').eq('creator_id', session.user.id).maybeSingle(),
        supabase.rpc('creator_earnings_summary'),
      ])
      if (!active) return
      if (settingsResult.error) setError(`Could not load your private settings: ${settingsResult.error.message}`)
      else if (settingsResult.data) setPrivateSettings(settingsResult.data)
      if (earningsResult.error) setError(`Could not load your earnings summary: ${earningsResult.error.message}`)
      else if (earningsResult.data?.[0]) setEarnings(earningsResult.data[0])
    }
    loadPrivateSettings().catch((loadError) => {
      if (active) setError(`Could not load creator settings: ${loadError.message}`)
    })
    return () => { active = false }
  }, [session])

  useEffect(() => {
    if (!supabase || !session || !creator.username) return undefined
    const channel = supabase.channel(`creator-supports:${creator.username}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'supports',
        filter: `creator_username=eq.${creator.username}`,
      }, (event) => {
        if (event.eventType === 'DELETE') {
          setSupporters((items) => items.filter((item) => item.id !== event.old.id))
        } else {
          const item = supporterFromRecord(event.new)
          setSupporters((items) => [item, ...items.filter((current) => current.id !== item.id)])
        }
        supabase.rpc('creator_earnings_summary').then(({ data, error: earningsError }) => {
          if (earningsError) setError(`Could not refresh earnings: ${earningsError.message}`)
          else if (data?.[0]) setEarnings(data[0])
        })
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [creator.username, session, setSupporters])

  const savePayoutSettings = async (event) => {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    const method = String(form.get('payout_method'))
    const upi = String(form.get('payout_upi_id')).trim()
    const holder = String(form.get('bank_account_holder')).trim()
    const account = String(form.get('bank_account_number')).trim()
    const ifsc = String(form.get('bank_ifsc')).trim().toUpperCase()
    if (!supabase || !session) {
      const data = { ...privateSettings, payout_method: method, payout_upi_id: upi, bank_account_holder: holder, bank_account_number: account, bank_ifsc: ifsc }
      save('superdrop-demo-payout-settings', data)
      setPrivateSettings(data)
      setSavedMessage('Your demo payout preferences were saved on this device.')
      return
    }
    if (method === 'upi' && !/^[\w.-]{2,100}@[A-Za-z0-9.-]{2,20}$/.test(upi)) {
      return setError('Enter a valid UPI ID, such as name@upi.')
    }
    if (method === 'bank' && (!holder || !/^\d{9,40}$/.test(account) || !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc))) {
      return setError('Enter the account holder, a 9–40 digit account number, and a valid 11-character IFSC.')
    }
    setPayoutSaving(true)
    const values = {
      payout_method: method,
      payout_upi_id: upi,
      bank_account_holder: holder,
      bank_account_number: account,
      bank_ifsc: ifsc,
    }
    try {
      const result = privateSettings
        ? await supabase.from('creator_private_settings').update(values).eq('creator_id', session.user.id).select().single()
        : await supabase.from('creator_private_settings').insert({ ...values, creator_id: session.user.id }).select().single()
      if (result.error) throw result.error
      setPrivateSettings(result.data)
      setSavedMessage('Private payout preferences saved. No payout will be sent in this demo.')
    } catch (saveError) {
      setError(`Could not save your payout settings: ${saveError.message}`)
    } finally {
      setPayoutSaving(false)
      window.setTimeout(() => setSavedMessage(''), 3500)
    }
  }

  const rotateOverlayToken = async () => {
    setRotatingToken(true)
    setError('')
    try {
      const { data, error: tokenError } = await supabase.rpc('rotate_creator_overlay_token')
      if (tokenError) throw tokenError
      setPrivateSettings((settings) => ({ ...settings, overlay_token: data }))
    } catch (tokenError) {
      setError(`Could not rotate your private overlay URL: ${tokenError.message}`)
    } finally {
      setRotatingToken(false)
    }
  }

  const markDone = async (id) => {
    try {
      if (supabase && session) {
        const { error: updateError } = await supabase.from('supports').update({ status: 'done' }).eq('id', id)
        if (updateError) throw updateError
      }
      setError('')
      setSupporters((items) => items.map((item) => item.id === id ? { ...item, status: 'done' } : item))
    } catch (updateError) {
      setError(`Could not update this message: ${updateError.message}`)
    }
  }
  const sendReply = async (item) => {
    const message = (reply[item.id] || '').trim()
    if (!message) return setError('Write a reply before sending it.')
    try {
      if (supabase && session) {
        const { error: updateError } = await supabase.from('supports').update({ reply: message }).eq('id', item.id)
        if (updateError) throw updateError
      }
      setError('')
      setSavedMessage('Reply saved.')
      setReply({ ...reply, [item.id]: '' })
      setReplyOpen({ ...replyOpen, [item.id]: false })
      window.setTimeout(() => setSavedMessage(''), 2500)
    } catch (updateError) {
      setError(`Could not send this reply: ${updateError.message}`)
    }
  }
  const saveProfile = async (event) => {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const username = String(data.get('username')).toLowerCase().trim()
    if (!/^[a-z0-9_]{3,20}$/.test(username)) return setError('Use 3–20 letters, numbers or underscores for your username.')
    if (reservedUsernames.has(username)) return setError('That username is reserved. Choose another one.')
    const updatedCreator = { ...creator, username, name: String(data.get('name')).trim(), tagline: String(data.get('tagline')).trim(), bio: String(data.get('bio')).trim(), avatar: String(data.get('avatar')).trim(), banner: String(data.get('banner')).trim(), instagram: String(data.get('instagram')).trim(), youtube: String(data.get('youtube')).trim(), website: String(data.get('website')).trim() }
    if (supabase && session) {
      try {
        const { error: updateError } = await supabase.from('profiles').update({
          username: updatedCreator.username,
          display_name: updatedCreator.name,
          tagline: updatedCreator.tagline,
          bio: updatedCreator.bio,
          avatar_url: updatedCreator.avatar,
          banner_url: updatedCreator.banner,
          links: { instagram: updatedCreator.instagram, youtube: updatedCreator.youtube, website: updatedCreator.website },
        }).eq('id', session.user.id)
        if (updateError) throw updateError
      } catch (updateError) {
        return setError(updateError.code === '23505'
          ? 'That username is already taken. Try another one.'
          : `Could not save your profile: ${updateError.message}`)
      }
    }
    setCreator(updatedCreator)
    setError('')
    setSavedMessage('Your creator page is looking fresh.')
    window.setTimeout(() => setSavedMessage(''), 2500)
  }
  if (supabase && !session) return <div className="dashboard-shell"><header className="dashboard-topbar"><Brand /><a className="visit-link" href="/demo"><ArrowLeft size={14} /> Back to creator page</a></header><main className="auth-required"><div className="auth-required-icon"><LockKeyhole size={23} /></div><p className="eyebrow">YOUR CREATOR SPACE</p><h1>Log in to your dashboard</h1><p>Your messages, earnings and private settings live in your account.</p><button className="button button-dark" onClick={onOpenAuth}>Continue with email or Google <ArrowRight size={15} /></button></main></div>
  return <div className="dashboard-shell">
    <header className="dashboard-topbar"><Brand /><div className="dash-top-right"><span className="demo-badge"><span /> {supabase ? 'Supabase connected' : 'Demo workspace'}</span><a className="visit-link" href={`/${creator.username}`} target="_blank" rel="noreferrer">View your page <ExternalLink size={14} /></a><button className="dash-avatar" aria-label="Open account settings" onClick={onAuth}>{creator.name.charAt(0)}</button></div></header>
    <div className="dashboard-frame">
      <aside className="sidebar"><div className="side-creator"><img src={creator.avatar} alt="" /><div><strong>{creator.name}</strong><span>@{creator.username}</span></div><MoreHorizontal size={17} /></div><p className="side-heading">WORKSPACE</p><nav className="side-nav" aria-label="Creator workspace">{menuItems.map(({ id, label, icon: Icon }) => <button key={id} onClick={() => setTab(id)} className={`side-nav-link ${tab === id ? 'active' : ''}`}><Icon size={18} />{label}{id === 'messages' && supporters.some((item) => item.status !== 'done') && <span className="nav-count">{supporters.filter((item) => item.status !== 'done').length}</span>}</button>)}</nav><div className="side-bottom"><div className="help-card"><Sparkles size={16} /><strong>Your page is yours</strong><p>Make it personal. Make it you.</p><button onClick={() => setTab('profile')}>Edit your page <ArrowRight size={13} /></button></div><a className="side-nav-link" href="/demo"><ArrowLeft size={17} /> Back to SuperDrop</a><div className="side-footer"><span>SUPERDROP · V1.0</span><button onClick={onAuth}><LogOut size={14} /> {authed ? 'Sign out' : 'Creator login'}</button></div></div></aside>
      <main className="dashboard-content">
        {!authed && <div className="demo-banner"><Sparkles size={16} /><span>You're exploring the demo creator space. Sign in to connect your account.</span><button onClick={onOpenAuth}>Sign in <ArrowRight size={14} /></button></div>}
        {tab === 'overview' && <Overview creator={creator} supporters={supporters} total={earnings?.all_time ?? total} earnings={earnings} onTab={setTab} />}
        {tab === 'messages' && <section><div className="dash-page-heading"><div><p className="eyebrow">YOUR COMMUNITY</p><h1>Messages <span className="heading-count">{supporters.length}</span></h1><p>Every message is a little moment between you and your people.</p></div><button className="button button-outline" onClick={() => setTab('profile')}><Settings2 size={15} /> Page settings</button></div>{error && <p className="form-error" role="alert">{error}</p>}{savedMessage && <p className="inline-success" role="status">{savedMessage}</p>}<div className="message-toolbar"><span>{supporters.filter((item) => item.status !== 'done').length} to check out</span><label className="sr-only" htmlFor="message-filter">Filter messages</label><select id="message-filter" className="filter-select" value={messageFilter} onChange={(event) => setMessageFilter(event.target.value)}><option value="all">All messages</option><option value="new">Needs a reply</option><option value="done">Done</option></select></div>{visibleSupporters.length === 0 ? <EmptyState title={supporters.length ? 'No messages in this filter' : 'Your inbox is taking a breather'} description={supporters.length ? 'Try another message filter.' : 'New support messages will show up here.'} /> : <div className="inbox-list">{visibleSupporters.map((item, index) => <article className="inbox-card" key={item.id}><div className="inbox-top"><span className={`inbox-avatar avatar-${index % 4}`}>{item.name === 'Anonymous' ? <LockKeyhole size={15} /> : item.name.charAt(0)}</span><div className="inbox-name"><strong>{item.name}</strong><span>{item.time}</span></div><span className="inbox-amount">{formatRupees(item.amount)}</span></div><div className="inbox-type">{item.type}</div><p className="inbox-message">{item.message || 'Sent you some love!'}</p>{replyOpen[item.id] && <div className="reply-box"><textarea aria-label={`Reply to ${item.name}`} placeholder="Write a kind reply…" value={reply[item.id] || ''} onChange={(event) => setReply({ ...reply, [item.id]: event.target.value })} /><button className="button button-dark" onClick={() => sendReply(item)}><Send size={14} /> Send reply</button></div>}<div className="inbox-actions">{item.status === 'done' ? <span className="done-tag"><CheckCircle2 size={14} /> Done</span> : <button className="done-button" onClick={() => markDone(item.id)}><Check size={14} /> Mark as done</button>}<button className="reply-button" onClick={() => setReplyOpen({ ...replyOpen, [item.id]: !replyOpen[item.id] })}><Send size={13} /> Reply</button></div></article>)}</div>}</section>}
        {tab === 'profile' && <section><div className="dash-page-heading"><div><p className="eyebrow">YOUR CORNER OF THE INTERNET</p><h1>My creator page</h1><p>Make it feel like you. Preview changes anytime.</p></div><a className="button button-outline" href={`/${creator.username}`} target="_blank" rel="noreferrer"><ExternalLink size={15} /> Preview page</a></div><form className="profile-form-card" onSubmit={saveProfile}><div className="form-section-title"><span>01</span><div><h2>The basics</h2><p>Your name, your vibe, your little corner.</p></div></div><div className="edit-avatar-row"><img src={creator.avatar} alt="" /><div><strong>Profile picture</strong><p>Add a publicly accessible image URL below.</p></div></div><div className="edit-grid"><label className="input-label">Display name<input className="text-input" name="name" defaultValue={creator.name} maxLength={48} required /></label><label className="input-label">Username<span>superdrop.app/</span><input className="text-input username-input" name="username" defaultValue={creator.username} maxLength={20} required /></label><label className="input-label full-field">Profile image URL<input className="text-input" name="avatar" type="url" defaultValue={creator.avatar} required /></label><label className="input-label full-field">Banner image URL<input className="text-input" name="banner" type="url" defaultValue={creator.banner} required /></label><label className="input-label full-field">One-line intro<input className="text-input" name="tagline" defaultValue={creator.tagline} maxLength={80} /></label><label className="input-label full-field">Your bio<textarea className="text-input edit-bio" name="bio" defaultValue={creator.bio} maxLength={240} /></label></div><div className="form-section-title form-section-spaced"><span>02</span><div><h2>Find me elsewhere</h2><p>Bring your other little corners together.</p></div></div><div className="edit-grid"><label className="input-label">Instagram<input className="text-input" name="instagram" defaultValue={creator.instagram} /></label><label className="input-label">YouTube<input className="text-input" name="youtube" defaultValue={creator.youtube} /></label><label className="input-label full-field">Website<input className="text-input" name="website" defaultValue={creator.website} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="save-profile-row">{savedMessage && <span className="inline-success"><CheckCircle2 size={15} />{savedMessage}</span>}<button className="button button-primary" type="submit">Save changes <ArrowRight size={15} /></button></div></form></section>}
        {tab === 'payouts' && <section><div className="dash-page-heading"><div><p className="eyebrow">YOUR SUPPORT TOTALS</p><h1>Payouts</h1><p>Track mock support totals and securely save payout preferences.</p></div></div><div className="earnings-highlight"><div><span>Total mock support</span><strong>{formatRupees(earningsTotal)}</strong><small>No payment was charged. This is not a payout balance.</small></div><div className="earnings-highlight-icon"><Wallet size={24} /></div></div><form key={privateSettings?.updated_at || 'payout-empty'} className="payout-settings-card" onSubmit={savePayoutSettings}><div className="payout-card-heading"><span className="payout-icon"><ArrowDownLeft size={19} /></span><div><h2>Private payout preferences</h2><p>Saved privately to your creator account. Payouts are not enabled.</p></div></div><label className="input-label payout-method-field">Preferred payout method<select className="text-input" name="payout_method" defaultValue={privateSettings?.payout_method || 'upi'}><option value="upi">UPI</option><option value="bank">Bank transfer</option></select></label><div className="edit-grid payout-fields"><label className="input-label">UPI ID<input className="text-input" name="payout_upi_id" defaultValue={privateSettings?.payout_upi_id || ''} placeholder="name@upi" autoComplete="off" /></label><label className="input-label">Account holder<input className="text-input" name="bank_account_holder" defaultValue={privateSettings?.bank_account_holder || ''} placeholder="As it appears at your bank" autoComplete="off" /></label><label className="input-label">Bank account number<input className="text-input" type="password" name="bank_account_number" defaultValue={privateSettings?.bank_account_number || ''} inputMode="numeric" autoComplete="off" /></label><label className="input-label">IFSC code<input className="text-input" name="bank_ifsc" defaultValue={privateSettings?.bank_ifsc || ''} autoComplete="off" maxLength={11} /></label></div>{error && <p className="form-error" role="alert">{error}</p>}{savedMessage && <p className="inline-success" role="status">{savedMessage}</p>}<button className="button button-dark payout-save" disabled={payoutSaving}>{payoutSaving ? 'Saving securely…' : 'Save payout preferences'} <Check size={15} /></button></form><div className="payout-note"><ShieldCheck size={16} /><p><strong>No transfers are enabled.</strong> Payment and payout credentials are not used to send or receive money in this mock-checkout version.</p></div></section>}
        {tab === 'overlay' && <section><div className="dash-page-heading"><div><p className="eyebrow">FOR YOUR NEXT STREAM</p><h1>Live overlay</h1><p>Show a little love on screen when fans support you.</p></div><span className="coming-soon">LIVE ALERTS</span></div><div className="overlay-setup-card"><div className="overlay-setup-title"><span className="payout-icon"><Play size={18} /></span><div><h2>Your OBS browser source</h2><p>This private link works as a browser source in OBS and Streamlabs.</p></div></div><div className="overlay-url-row"><code>{overlayUrl}</code><button className="button button-dark" onClick={async () => { try { await navigator.clipboard.writeText(overlayUrl); setSavedMessage('Private overlay URL copied!') } catch { setSavedMessage('Copy the complete private overlay URL from the address field.') } window.setTimeout(() => setSavedMessage(''), 2500) }}><Copy size={14} /> Copy private URL</button></div>{supabase && <button className="overlay-rotate" type="button" disabled={rotatingToken} onClick={rotateOverlayToken}>{rotatingToken ? 'Rotating…' : 'Rotate private URL'}</button>}<div className="overlay-instructions"><strong>Quick setup</strong><ol><li>Add a <b>Browser Source</b> to your stream scene.</li><li>Paste the complete URL above. Suggested size: <b>800 × 260</b>.</li><li>Keep the source hidden until it’s time for a SuperDrop.</li></ol></div><a className="button button-outline" href={`/overlay/${creator.username}${privateSettings?.overlay_token ? `?token=${privateSettings.overlay_token}` : ''}`} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Preview your overlay</a>{savedMessage && <span className="inline-success overlay-copied"><CheckCircle2 size={14} />{savedMessage}</span>}</div><p className="overlay-note"><Sparkles size={15} /> Live alerts need a deployed Supabase Realtime project. Support amounts are simulated and no payment is processed.</p></section>}
        {tab === 'overview' && <p className="dashboard-footer-note">Made for creators who make the internet feel a little smaller.</p>}
      </main>
    </div>
  </div>
}

function Overview({ creator, supporters, total, earnings, onTab }) {
  const recent = supporters.slice(0, 4)
  const dateLabel = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).format(new Date()).toUpperCase()
  const totals = [
    { label: 'Today', value: earnings?.today ?? total },
    { label: 'This week', value: earnings?.this_week ?? total },
    { label: 'This month', value: earnings?.this_month ?? total },
  ]
  return <section><div className="welcome-row"><div><p className="eyebrow">{dateLabel}</p><h1>Hey, {creator.name.split(' ')[0]} <span className="wave-mark">✳</span></h1><p>Look at you, building your own little corner of the internet.</p></div><a className="button button-primary" href={`/${creator.username}`} target="_blank" rel="noreferrer"><Play size={14} fill="currentColor" /> View my page</a></div><div className="earnings-grid"><article className="earning-card earning-main"><div className="earning-title"><span>All-time mock support</span><span className="earning-icon"><CircleDollarSign size={17} /></span></div><strong>{formatRupees(total)}</strong><div className="earning-sub"><span><TrendingUp size={13} /> Simulated only</span><span>Not real earnings</span></div><div className="earnings-sparkline" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i /></div></article>{totals.map((item) => <article className="earning-card" key={item.label}><div className="earning-title"><span>{item.label}</span><span className="earning-small-icon"><ArrowDownLeft size={15} /></span></div><strong>{formatRupees(item.value)}</strong><div className="mini-chart" aria-hidden="true"><i /><i /><i /><i /><i /><i /><i /></div></article>)}</div><div className="dashboard-section-heading"><div><p className="eyebrow">A LITTLE LOVE</p><h2>Latest drops</h2></div><button className="text-button" onClick={() => onTab('messages')}>See all messages <ArrowRight size={14} /></button></div><div className="overview-supporters">{recent.map((item, index) => <article className="overview-supporter" key={item.id}><span className={`inbox-avatar avatar-${index % 4}`}>{item.name === 'Anonymous' ? <LockKeyhole size={15} /> : item.name.charAt(0)}</span><div><strong>{item.name}</strong><p>{item.message || 'Sent some love!'}</p><small>{item.time} · {item.type}</small></div><b>{formatRupees(item.amount)}</b></article>)}</div><div className="share-card"><div className="share-card-mark"><Share2 size={20} /></div><div><strong>Your page. Your people.</strong><p>Send your link to the people who make it all worth it.</p></div><button className="button button-dark" onClick={async (event) => { try { await navigator.clipboard.writeText(`${location.origin}/${creator.username}`); event.currentTarget.innerText = 'Link copied!' } catch { event.currentTarget.innerText = `/${creator.username}` } }}>Copy page link <Copy size={14} /></button></div></section>
}

function EmptyState({ title, description }) {
  return <div className="empty-state"><span><MessageCircle size={21} /></span><strong>{title}</strong><p>{description}</p></div>
}

function Admin({ session }) {
  const [creators, setCreators] = useState([])
  const [transactions, setTransactions] = useState([])
  const [overview, setOverview] = useState(null)
  const [fee, setFee] = useState(() => getSaved('superdrop-platform-fee', 5))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(Boolean(supabase))
  const [busyCreator, setBusyCreator] = useState('')
  const [saved, setSaved] = useState(false)
  const [blocked, setBlocked] = useStoredState('superdrop-blocked-creators', {})

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      setCreators([{ id: 'demo', username: 'demo', display_name: initialCreator.name, avatar_url: initialCreator.avatar, status: 'active', support_count: initialSupporters.length }])
      setTransactions(initialSupporters.map((item) => ({
        ...item,
        creator_username: 'demo',
        creator_name: initialCreator.name,
        payment_status: 'mock',
      })))
      return undefined
    }

    let active = true
    const loadAdminData = async () => {
      const [creatorResult, transactionResult, overviewResult] = await Promise.all([
        supabase.rpc('admin_list_creators'),
        supabase.rpc('admin_list_transactions'),
        supabase.rpc('admin_overview'),
      ])
      if (!active) return
      const failed = [creatorResult.error, transactionResult.error, overviewResult.error].find(Boolean)
      if (failed) {
        setError(`Could not load admin data: ${failed.message}`)
        setLoading(false)
        return
      }
      setCreators(creatorResult.data || [])
      setTransactions(transactionResult.data || [])
      const summary = overviewResult.data?.[0]
      setOverview(summary || null)
      if (summary) setFee(Number(summary.platform_fee))
      setLoading(false)
    }
    loadAdminData().catch((loadError) => {
      if (active) {
        setError(`Could not load admin data: ${loadError.message}`)
        setLoading(false)
      }
    })
    return () => { active = false }
  }, [])

  const toggleCreator = async (creator) => {
    const shouldBlock = creator.status === 'active'
    setBusyCreator(creator.username)
    setError('')
    try {
      if (supabase) {
        const { error: rpcError } = await supabase.rpc('admin_set_creator_blocked', {
          p_username: creator.username,
          p_blocked: shouldBlock,
        })
        if (rpcError) throw rpcError
      } else {
        setBlocked((items) => ({ ...items, [creator.username]: shouldBlock }))
      }
      setCreators((items) => items.map((item) => item.username === creator.username
        ? { ...item, status: shouldBlock ? 'blocked' : 'active' }
        : item))
    } catch (updateError) {
      setError(`Could not update ${creator.display_name}: ${updateError.message}`)
    } finally {
      setBusyCreator('')
    }
  }

  const updateFee = async (event) => {
    event.preventDefault()
    setError('')
    try {
      if (supabase) {
        const { data, error: rpcError } = await supabase.rpc('admin_set_platform_fee', { p_fee: fee })
        if (rpcError) throw rpcError
        setFee(Number(data))
      } else {
        save('superdrop-platform-fee', fee)
      }
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2000)
    } catch (feeError) {
      setError(`Could not save the platform fee: ${feeError.message}`)
    }
  }

  const creatorCount = overview?.creator_count ?? creators.length
  const transactionCount = overview?.transaction_count ?? transactions.length
  const mockTotal = overview?.total_mock_amount ?? transactions.reduce((sum, item) => sum + item.amount, 0)
  return <div className="dashboard-shell"><header className="dashboard-topbar"><Brand /><div className="dash-top-right"><span className="admin-pill"><ShieldCheck size={14} /> ADMIN CONSOLE</span><a className="visit-link" href="/dashboard">Creator dashboard <ArrowRight size={14} /></a>{supabase && session && <button className="dash-avatar" aria-label="Sign out" onClick={async () => { const { error: signOutError } = await supabase.auth.signOut(); if (signOutError) setError(`Could not sign out: ${signOutError.message}`) }}>{session.user.email?.charAt(0).toUpperCase()}</button>}</div></header><main className="admin-page"><div className="dash-page-heading"><div><p className="eyebrow">PLATFORM CONTROL</p><h1>Admin console</h1><p>Manage creators, transactions and your platform settings.</p></div><span className={`demo-badge ${supabase ? '' : 'demo-only-badge'}`}><span />{supabase ? 'Supabase connected' : 'Demo data'}</span></div>{error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="inline-success" role="status">{notice}</p>}<div className="admin-stats"><article><span>Total creators</span><strong>{loading ? '…' : creatorCount}</strong><small>{creators.filter((item) => item.status === 'active').length} active creator(s)</small></article><article><span>Support submissions</span><strong>{loading ? '…' : transactionCount}</strong><small>Mock checkout · no payments</small></article><article><span>Mock support total</span><strong>{loading ? '…' : formatRupees(mockTotal)}</strong><small>Not real earnings</small></article></div><section className="admin-card"><div className="admin-card-heading"><div><h2>Creator accounts</h2><p>Review and manage creators on SuperDrop.</p></div><span className="creator-count-tag">{creatorCount} creator(s)</span></div><div className="admin-table"><div className="admin-table-head"><span>CREATOR</span><span>STATUS</span><span>SUPPORTERS</span><span>ACTION</span></div>{loading && <EmptyState title="Loading creator accounts" description="Getting the latest creator data from Supabase." />}{!loading && creators.length === 0 && <EmptyState title="No creators yet" description="Creator accounts will show up here after they sign up." />}{creators.map((creator) => <div className="admin-row" key={creator.id}><div className="admin-creator-cell"><img src={creator.avatar_url || initialCreator.avatar} alt="" /><div><strong>{creator.display_name}</strong><small>@{creator.username}</small></div></div><span className={`creator-status ${creator.status === 'blocked' ? 'blocked' : ''}`}><i />{creator.status === 'blocked' ? 'Blocked' : 'Active'}</span><span>{creator.support_count}</span><button className={`button ${creator.status === 'blocked' ? 'button-outline' : 'button-danger-outline'}`} disabled={busyCreator === creator.username} onClick={() => toggleCreator(creator)}>{busyCreator === creator.username ? 'Saving…' : creator.status === 'blocked' ? 'Unblock' : 'Block creator'}</button></div>)}</div></section><section className="admin-card fee-card"><div><h2>Platform fee</h2><p>Set a percentage fee. Mock checkout does not collect it.</p></div><form onSubmit={updateFee}><div className="fee-control"><input type="number" min="0" max="30" step="0.5" aria-label="Platform fee percentage" value={fee} onChange={(event) => setFee(Math.min(30, Math.max(0, Number(event.target.value))))} /><span>%</span></div><button className="button button-dark">Save setting</button>{saved && <span className="inline-success"><Check size={14} /> Saved</span>}</form></section><section className="admin-card"><div className="admin-card-heading"><div><h2>Recent submissions</h2><p>Latest mock supports across all creators. No payment was made.</p></div></div><div className="transaction-list">{transactions.map((item) => <div key={item.id}><span className="transaction-icon"><ArrowDownLeft size={15} /></span><div><strong>{item.name || item.fan_name} <span>→ {item.creator_name}</span></strong><small>{item.time || new Date(item.created_at).toLocaleString()} · {item.type || item.request_type}</small></div><b>{formatRupees(item.amount)}</b><span className="transaction-status">MOCK</span></div>)}</div></section></main></div>
}

function Overlay({ creator: initialProfile, username, token }) {
  const [alert, setAlert] = useState(supabase ? null : initialSupporters[0])
  const [creator, setCreator] = useState(initialProfile)
  const [connection, setConnection] = useState(supabase ? 'CONNECTING' : 'DEMO')

  useEffect(() => {
    if (!supabase || !token || !username) return undefined
    const channel = supabase.channel(`superdrop:${token}`)
      .on('broadcast', { event: 'support' }, ({ payload }) => {
        setAlert({
          name: payload.is_anonymous ? 'Anonymous' : payload.fan_name,
          amount: payload.amount,
          message: payload.message,
          type: payload.request_type,
          creator_name: payload.creator_name,
          avatar_url: payload.avatar_url,
        })
      })
      .subscribe((status) => setConnection(status === 'SUBSCRIBED' ? 'LIVE' : status))
    let active = true
    const loadProfile = async () => {
      const { data, error } = await supabase.from('profiles')
        .select('username, display_name, tagline, bio, avatar_url, banner_url, links')
        .eq('username', username)
        .eq('status', 'active')
        .maybeSingle()
      if (!active) return
      if (error) console.error('Could not load overlay creator profile', error)
      else if (data) setCreator(creatorFromProfile(data))
    }
    loadProfile().catch((error) => console.error('Could not load overlay creator profile', error))
    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [token, username])

  if (supabase && !token) return <main className="overlay-page"><div className="overlay-alert"><div className="overlay-brand"><span className="brand-mark"><ArrowDownLeft size={15} strokeWidth={3} /></span> SUPERDROP ALERTS</div><div className="overlay-empty"><Sparkles size={20} /><strong>This overlay URL needs its private token.</strong><p>Copy your complete, private overlay link from Dashboard → Live overlay.</p></div></div></main>
  return <main className="overlay-page"><div className="overlay-alert"><div className="overlay-brand"><span className="brand-mark"><ArrowDownLeft size={15} strokeWidth={3} /></span> SUPERDROP MOCK ALERT <span className="overlay-connection">{connection}</span></div>{alert ? <div className="overlay-support"><img src={alert.avatar_url || creator.avatar} alt="" /><div><span className="overlay-overline"><Sparkles size={13} /> DEMO SUPPORT</span><h1>{alert.name || 'A lovely fan'} sent {formatRupees(alert.amount || 99)}</h1><p>“{alert.message || 'You’re doing amazing!'}”</p></div></div> : <div className="overlay-empty"><Sparkles size={20} /><strong>Waiting for a mock support…</strong><p>Demo alerts are simulated; no payment is made.</p></div>}<div className="overlay-thanks">DEMO ONLY · NO PAYMENT WAS MADE</div></div></main>
}

const legalContent = {
  terms: ['Terms of service', [
    'SuperDrop helps creators connect with their communities through public profiles, messages and simulated support. Checkout in this V1 is a demonstration only: no money is collected, transferred or owed, and the platform-fee setting is not charged.',
    'Use the service only for lawful purposes. Do not submit abusive, unlawful, misleading or infringing content, or attempt to disrupt the service. Creators are responsible for the content and links on their profiles. SuperDrop may remove content or restrict access to address abuse.',
    'The service is provided as a preview and may change. These starter terms are not a substitute for reviewed terms identifying the operating business, governing law and support contact.',
  ]],
  privacy: ['Privacy policy', [
    'Without Supabase configured, this preview saves demo profile edits, support messages, theme preference and demo admin settings in the browser’s local storage.',
    'With Supabase configured, account and profile information is processed by the project operator’s Supabase project. Creator usernames, display names, bios, profile images and social links are public. Supporter names (unless anonymous), messages, request types and mock amounts are stored; a creator’s completed requests may appear in the public supporters feed. Creators and authorized administrators can view relevant submissions.',
    'Creator payout preferences entered in the dashboard are stored in a private, account-restricted table for demonstration purposes. They are not used to send payouts. Do not enter real bank or UPI details. The mock support endpoint uses a keyed, pseudonymous network fingerprint for rate limiting and removes old rate-limit records during later requests.',
    'No real payment is initiated and payment-card data is not collected. Before public launch, the operator must publish its identity, contact and data-rights process, confirm its retention practices, and obtain a privacy review.',
  ]],
  refunds: ['Refund policy', [
    'All support amounts in this SuperDrop V1 are mock values. No payment is charged, no funds are received, and no refund is due.',
    'Do not treat a mock submission or dashboard total as a payment, balance or earnings. Real payment and refund terms will be published before any live payment feature is enabled.',
  ]],
}

function LegalPage({ type }) {
  const [title, paragraphs] = legalContent[type] || legalContent.terms
  return <div className="legal-shell"><header className="dashboard-topbar"><Brand /><a className="visit-link" href="/demo"><ArrowLeft size={14} /> Back to creator page</a></header><main className="legal-content"><p className="eyebrow">SUPERDROP · V1</p><h1>{title}</h1><p className="legal-updated">Last updated: November 2026</p>{paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}<p>This is starter copy for the product preview, not legal advice. Replace it with reviewed terms and your actual business and contact details before public launch.</p></main></div>
}

export default function App() {
  const [creator, setCreator] = useStoredState('superdrop-demo-creator', initialCreator)
  const [supporters, setSupporters] = useStoredState('superdrop-demo-supporters', initialSupporters)
  const [theme, setTheme] = useStoredState('superdrop-theme', 'light')
  const [payment, setPayment] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [session, setSession] = useState(null)
  const [notice, setNotice] = useState('')
  const path = window.location.pathname
  const normalizedPath = useMemo(() => path.replace(/\/+$/, '') || '/', [path])
  const reservedPaths = ['/dashboard', '/admin', '/terms', '/privacy', '/refunds']
  const isPublic = (normalizedPath === '/' || normalizedPath.split('/').filter(Boolean).length === 1)
    && !reservedPaths.includes(normalizedPath)
  const [publicCreatorMissing, setPublicCreatorMissing] = useState(false)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])
  useEffect(() => {
    if (supabaseConfigError) setNotice(supabaseConfigError)
  }, [])
  useEffect(() => {
    if (!supabase) return undefined
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setNotice(`Could not restore sign-in: ${error.message}`)
      else setSession(data.session)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, currentSession) => setSession(currentSession))
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!isPublic || normalizedPath === '/' || normalizedPath === '/demo') {
      setPublicCreatorMissing(false)
      return undefined
    }

    const username = normalizedPath.slice(1)
    if (!supabase) {
      setPublicCreatorMissing(username !== creator.username)
      return undefined
    }

    let active = true
    const loadPublicCreator = async () => {
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('username, display_name, tagline, bio, avatar_url, banner_url, links')
        .eq('username', username)
        .eq('status', 'active')
        .maybeSingle()
      if (!active) return
      if (profileError) {
        setPublicCreatorMissing(true)
        setNotice(`Could not load this creator page: ${profileError.message}`)
        return
      }
      if (!profile) {
        setPublicCreatorMissing(true)
        return
      }
      setPublicCreatorMissing(false)
      setCreator(creatorFromProfile(profile))
      const { data: records, error: supportsError } = await supabase.from('supports')
        .select('id, fan_name, is_anonymous, message, amount, request_type, status, created_at')
        .eq('creator_username', username)
        .eq('status', 'done')
        .order('created_at', { ascending: false })
        .limit(4)
      if (!active) return
      if (supportsError) {
        setNotice(`Could not load recent supporters: ${supportsError.message}`)
        return
      }
      setSupporters((records || []).map(supporterFromRecord))
    }
    loadPublicCreator().catch((error) => {
      if (active) setNotice(`Could not load this creator page: ${error.message}`)
    })
    return () => { active = false }
  }, [creator.username, isPublic, normalizedPath, setCreator, setSupporters])

  useEffect(() => {
    if (!supabase || !isPublic || normalizedPath === '/' || normalizedPath === '/demo') return undefined
    const username = normalizedPath.slice(1)
    const channel = supabase.channel(`public-supporters:${username}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'supports',
        filter: `creator_username=eq.${username}`,
      }, ({ new: record }) => {
        if (record.status !== 'done') return
        const item = supporterFromRecord(record)
        setSupporters((items) => [item, ...items.filter((current) => current.id !== item.id)].slice(0, 4))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isPublic, normalizedPath, setSupporters])

  useEffect(() => {
    if (!supabase || !session || normalizedPath !== '/dashboard') return undefined
    let active = true
    const loadDashboardData = async () => {
      const { data: profile, error: profileError } = await supabase.from('profiles')
        .select('username, display_name, tagline, bio, avatar_url, banner_url, links')
        .eq('id', session.user.id)
        .maybeSingle()
      if (!active) return
      if (profileError) {
        setNotice(`Could not load your creator profile: ${profileError.message}`)
        return
      }
      if (!profile) {
        setNotice('Your creator profile is still being set up. Refresh the page in a moment.')
        return
      }
      setCreator(creatorFromProfile(profile))
      const { data: records, error: supportsError } = await supabase.from('supports')
        .select('id, fan_name, is_anonymous, message, amount, request_type, status, created_at')
        .eq('creator_username', profile.username)
        .order('created_at', { ascending: false })
        .limit(100)
      if (!active) return
      if (supportsError) {
        setNotice(`Could not load your messages: ${supportsError.message}`)
        return
      }
      setSupporters((records || []).map(supporterFromRecord))
    }
    loadDashboardData().catch((error) => {
      if (active) setNotice(`Could not load your creator workspace: ${error.message}`)
    })
    return () => { active = false }
  }, [session, normalizedPath, setCreator, setSupporters])

  const createSupport = (support) => setPayment({ ...support, creator })
  const completePayment = async () => {
    let record
    if (supabase && payment.creator.username !== 'demo') {
      const { data, error } = await supabase.functions.invoke('submit-support', {
        body: {
          creator_username: payment.creator.username,
          fan_name: payment.name,
          is_anonymous: payment.name === 'Anonymous',
          message: payment.message,
          amount: payment.amount,
          request_type: payment.type,
        },
      })
      if (error) {
        let detail = error.message
        if (error.context instanceof Response) {
          try {
            const body = await error.context.json()
            detail = body.error || detail
          } catch {
            detail = error.message
          }
        }
        throw new Error(detail)
      }
      record = supporterFromRecord(data.support)
    } else {
      const previous = Number(localStorage.getItem('superdrop-last-support') || 0)
      if (Date.now() - previous < 15000) throw new Error('Please wait a moment before sending another support.')
      localStorage.setItem('superdrop-last-support', String(Date.now()))
      record = { ...payment, id: `s-${Date.now()}`, time: 'just now', status: 'new' }
    }
    setSupporters((items) => [record, ...items.filter((current) => current.id !== record.id)])
    return true
  }
  const signOut = async () => {
    if (supabase && session) {
      const { error } = await supabase.auth.signOut()
      if (error) setNotice(`Could not sign out: ${error.message}`)
      else setNotice('You have been signed out.')
    } else {
      localStorage.removeItem('superdrop-demo-email')
      setNotice('You have been signed out of the demo.')
    }
    setAuthOpen(false)
  }
  const onAuth = () => {
    if (session || localStorage.getItem('superdrop-demo-email')) signOut()
    else setAuthOpen(true)
  }
  const signedIn = Boolean(session || localStorage.getItem('superdrop-demo-email'))

  let page
  if (isPublic && publicCreatorMissing) page = <div className="not-found"><Brand /><h1>This creator page wandered off.</h1><p>Check the username and try again.</p><a className="button button-dark" href="/demo">Meet a creator <ArrowRight size={15} /></a></div>
  else if (isPublic) page = <CreatorPage creator={creator} supporters={supporters} onSupport={createSupport} theme={theme} setTheme={setTheme} onAuth={() => signedIn ? location.assign('/dashboard') : setAuthOpen(true)} />
  else if (normalizedPath === '/dashboard') page = <Dashboard creator={creator} setCreator={setCreator} supporters={supporters} setSupporters={setSupporters} onAuth={onAuth} authed={signedIn} onOpenAuth={() => setAuthOpen(true)} session={session} />
  else if (normalizedPath === '/admin') page = supabase && !session ? <div className="unauthorized"><LockKeyhole size={30} /><h1>Admin sign-in required</h1><p>Sign in with an account that has admin permissions.</p><button className="button button-dark" onClick={() => setAuthOpen(true)}>Sign in <ArrowRight size={15} /></button></div> : supabase && session.user.app_metadata?.role !== 'admin' ? <div className="unauthorized"><LockKeyhole size={30} /><h1>Admin access only</h1><p>This account does not have admin permissions.</p><a className="button button-dark" href="/dashboard">Back to dashboard</a></div> : <Admin session={session} />
  else if (normalizedPath.startsWith('/overlay/')) page = <Overlay creator={creator} username={normalizedPath.slice('/overlay/'.length)} token={new URLSearchParams(location.search).get('token')} />
  else if (['/terms', '/privacy', '/refunds'].includes(normalizedPath)) page = <LegalPage type={normalizedPath.slice(1)} />
  else page = <div className="not-found"><Brand /><h1>This page wandered off.</h1><p>Let’s get you back to the good stuff.</p><a className="button button-dark" href="/demo">Meet a creator <ArrowRight size={15} /></a></div>

  return <>{page}{payment && <PaymentModal support={payment} onClose={() => setPayment(null)} onPay={completePayment} />}{authOpen && <LoginModal onClose={() => setAuthOpen(false)} onSignedIn={() => { setAuthOpen(false); location.assign('/dashboard') }} />}{notice && <div className={`toast ${notice.startsWith('Could not') || notice.startsWith('Demo checkout') ? 'toast-error' : ''}`} role="status">{notice.startsWith('Could not') || notice.startsWith('Demo checkout') ? <X size={15} /> : <Check size={15} />}{notice}<button onClick={() => setNotice('')} aria-label="Dismiss notification"><X size={14} /></button></div>}</>
}
