import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import {
  CalendarDays, ClipboardList, Clock, Bell, LogOut, Zap,
  CheckCircle, XCircle, AlertTriangle, ArrowRight, Timer,
  Users, Flame, MapPin, ChevronRight, Activity, TrendingUp,
} from 'lucide-react'
import { Spinner, Toast, Modal, ProgressRing, EmptyState, Avatar, Skeleton, KpiCard } from '../components/ui'
import Layout from '../components/Layout'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKLY_LIMIT = 56
const DAILY_LIMIT  = 8

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d
  })
}
function getWeekMonday() {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  d.setHours(0,0,0,0)
  return d
}
/** "09:00" → "9:00 AM", "14:30" → "2:30 PM" */
function fmt12(t: string) {
  if (!t) return ''
  const s = t.trim()
  if (!s || s === '00:00') return ''
  const [h, m] = s.split(':').map(Number)
  if (isNaN(h)) return s
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}
/** "2026-06-01" → "Mon, 1 Jun" (ISO input) */
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}
/** Same as fmtDate but named clearly for ISO input */
function fmtDateFromISO(d: string) {
  if (!d) return ''
  const dt = new Date(d + 'T00:00:00')
  if (isNaN(dt.getTime())) return d
  return `${DAYS[dt.getDay()]}, ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}

/** Convert DD.MM.YYYY or YYYY-MM-DD → YYYY-MM-DD for date arithmetic */
function toISO(raw: string): string {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [d,m,y] = raw.split('.'); return `${y}-${m}-${d}`
  }
  return raw
}

type Rider = { nb: string; name: string; email: string; phone: string }
type Shift  = { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; booked: number; status: string; notes: string }
type Booking = {
  id:           string   // A Booking_ID
  riderNb:      string   // B Rider_NB
  riderName:    string   // C Rider_Name
  shiftId:      string   // D Shift_ID
  shiftDate:    string   // E Shift_Date  DD.MM.YYYY
  day:          string   // F Day
  startTime:    string   // G Start_Time  HH:mm
  endTime:      string   // H End_Time    HH:mm
  hours:        number   // I Hours
  status:       string   // J Status
  cancelReason: string   // K Cancel_Reason
  createdAt:    string   // L Created_At
  updatedAt:    string   // M Updated_At
}

export default function RiderPortal() {
  const [rider,         setRider]         = useState<Rider | null>(null)
  const [page,          setPage]          = useState<'shifts'|'mybookings'|'upcoming'|'notifications'>('shifts')
  const [shifts,        setShifts]        = useState<Shift[]>([])
  const [bookings,      setBookings]      = useState<Booking[]>([])
  const [selectedDate,  setSelectedDate]  = useState(() => {
    // Use local date, not UTC (toISOString gives UTC which can be wrong day)
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })
  const [loading,       setLoading]       = useState(false)
  const [syncing,       setSyncing]       = useState(false)
  const [lastSync,      setLastSync]      = useState<Date|null>(null)
  const [toast,         setToast]         = useState<{type:any;message:string}|null>(null)
  const [cancelModal,   setCancelModal]   = useState<{bookingId:string;reason:string}|null>(null)
  const [nb,            setNb]            = useState('')
  const [contact,       setContact]       = useState('')
  const [loginErr,      setLoginErr]      = useState('')
  const [loginLoading,  setLoginLoading]  = useState(false)
  const [successId,     setSuccessId]     = useState<string|null>(null)

  const showToast = (type: any, message: string) => setToast({ type, message })

  const loadData = useCallback(async (silent = false) => {
    if (!rider) return
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [sRes, bRes] = await Promise.all([fetch('/api/shifts'), fetch('/api/bookings')])
      if (sRes.ok) {
        const sData = await sRes.json()
        setShifts(Array.isArray(sData) ? sData : [])
      }
      if (bRes.ok) {
        const bData = await bRes.json()
        setBookings(Array.isArray(bData) ? bData : [])
      }
      if (!sRes.ok || !bRes.ok) {
        showToast('error', 'Failed to load data. Retrying shortly.')
      }
    } catch {
      if (!silent) showToast('error', 'Network error. Check your connection.')
    } finally {
      setLoading(false); setSyncing(false)
      setLastSync(new Date())
    }
  }, [rider])

  useEffect(() => {
    if (!rider) return
    loadData()
    const t = setInterval(() => loadData(true), 30000)
    return () => clearInterval(t)
  }, [rider, loadData])

  async function login() {
    setLoginLoading(true); setLoginErr('')
    try {
      const res  = await fetch('/api/auth/rider-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nb, contact }),
      })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error || 'Login failed'); return }
      setRider(data.rider)
    } catch { setLoginErr('Network error. Please try again.') }
    finally { setLoginLoading(false) }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setRider(null); setShifts([]); setBookings([])
  }

  async function bookShift(shiftId: string) {
    setLoading(true)
    try {
      const res  = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId }),
      })
      const data = await res.json()
      if (!res.ok) { showToast('error', data.error); return }
      setSuccessId(shiftId)
      setTimeout(() => setSuccessId(null), 3500)
      showToast('success', `Shift booked! ${data.weeklyRemaining}h remaining this week.`)
      await loadData(true)
    } finally { setLoading(false) }
  }

  async function cancelBooking() {
    if (!cancelModal?.reason) { showToast('warning', 'Please select a reason'); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/bookings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancelModal.bookingId, reason: cancelModal.reason }),
      })
      const data = await res.json()
      if (!res.ok) { showToast('error', data.error); return }
      showToast('success', 'Booking cancelled')
      setCancelModal(null); await loadData(true)
    } finally { setLoading(false) }
  }

  // ── Computed values ────────────────────────────────────────
  const myBookings    = bookings.filter(b => b.riderNb === rider?.nb)
  const myConfirmed   = myBookings.filter(b => b.status === 'Confirmed')
  const myCancelled   = myBookings.filter(b => b.status === 'Cancelled')
  // Weekly cancellations — only count cancellations where shiftDate is this week
  const monday2 = getWeekMonday()
  const sunday2 = new Date(monday2); sunday2.setDate(monday2.getDate() + 6)
  const weeklyCancels = myCancelled.filter(b => {
    const iso = toISO(b.shiftDate)
    if (!iso) return false
    const d = new Date(iso + 'T00:00:00')
    return d >= monday2 && d <= sunday2
  }).length
  const bookedIds     = new Set(myConfirmed.map(b => b.shiftId))

  // ── Weekly/daily hours from booking rows (shiftDate field) ──
  // Source of truth: Shift_Date in booking row, not a join with Shifts array.
  const monday = getWeekMonday()
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)

  const weeklyHours = parseFloat(
    myConfirmed
      .filter(b => {
        // Use shiftDate from booking row first; fall back to shift data
        const s = shifts.find(x => x.id === b.shiftId)
        const dateISO = b.shiftDate ? toISO(b.shiftDate) : (s ? toISO(s.date) : '')
        if (!dateISO) return false
        const d = new Date(dateISO + 'T00:00:00')
        return d >= monday && d <= sunday
      })
      .reduce((a, b) => {
        const s = shifts.find(x => x.id === b.shiftId)
        return a + (b.hours || s?.hours || 0)
      }, 0)
      .toFixed(1)
  )

  const dailyShifts = myConfirmed.filter(b => {
    const s = shifts.find(x => x.id === b.shiftId)
    const dateISO = b.shiftDate ? toISO(b.shiftDate) : (s ? toISO(s.date) : '')
    return dateISO === selectedDate
  })
  const dailyHours = parseFloat(
    dailyShifts.reduce((a, b) => {
      const s = shifts.find(x => x.id === b.shiftId)
      return a + (b.hours || s?.hours || 0)
    }, 0).toFixed(1)
  )
  // Local today for date tab highlighting
  const localToday = (() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  })()
  const dayShifts     = shifts.filter(s => s.date === selectedDate)
  const weeklyPct     = Math.min(weeklyHours / WEEKLY_LIMIT * 100, 100)

  // ── LOGIN ──────────────────────────────────────────────────
  if (!rider) {
    return (
      <>
        <Head><title>FleetOps — Rider Login</title></Head>
        <div className="app-bg" aria-hidden>
          <div className="app-grid" />
          <div className="app-scanline" />
        </div>
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
        <div className="login-wrap">
          <div className="login-card anim-up">
            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
              <div className="logo-icon" style={{ width:42, height:42, borderRadius:13 }}>
                <Zap size={20} color="#fff" fill="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:17, color:'#f1f5ff', letterSpacing:'-0.3px' }}>FleetOps</div>
                <div style={{ fontSize:11, color:'#60a5fa', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>Rider Portal</div>
              </div>
            </div>

            <h1 style={{ fontSize:26, fontWeight:800, color:'#f1f5ff', letterSpacing:'-0.5px', marginBottom:4 }}>Welcome back</h1>
            <p style={{ fontSize:13.5, color:'rgba(100,116,139,0.85)', marginBottom:28 }}>Sign in with your MB No and registered contact</p>

            {loginErr && (
              <div className="alert alert-danger" style={{ marginBottom:20 }}>
                <XCircle size={15} style={{ flexShrink:0, marginTop:1 }} /> {loginErr}
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>MB No</label>
              <input className="input-field" placeholder="e.g. MB001" value={nb} onChange={e => setNb(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Email or Phone</label>
              <input className="input-field" placeholder="your@email.com or +44..." value={contact} onChange={e => setContact(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>

            <button
              className="btn-primary"
              style={{ width:'100%', justifyContent:'center', padding:'13px', borderRadius:14, fontSize:15 }}
              onClick={login} disabled={loginLoading}
            >
              {loginLoading ? <><Spinner size={16} /> Signing in...</> : <>Sign In <ArrowRight size={16} /></>}
            </button>

            <p style={{ textAlign:'center', fontSize:12, color:'rgba(100,116,139,0.5)', marginTop:20 }}>
              Contact your admin if you need your MB No
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── NAV ───────────────────────────────────────────────────
  const navItems = [
    { id:'shifts',        label:'Available Shifts',  icon:CalendarDays },
    { id:'mybookings',    label:'My Bookings',        icon:ClipboardList },
    { id:'upcoming',      label:'Upcoming Shifts',    icon:Clock },
    { id:'notifications', label:'Notifications',      icon:Bell, badge: weeklyCancels > 0 ? weeklyCancels : undefined },
  ]

  const sidebarTop = (
    <div style={{ padding:'8px 6px 10px', display:'flex', alignItems:'center', gap:10 }}>
      <Avatar name={rider.name} size="sm" />
      <div style={{ minWidth:0 }}>
        <div style={{ fontWeight:600, fontSize:13, color:'#e1e7f5', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{rider.name}</div>
        <span className="rider-tag" style={{ fontSize:10 }}>MB: {rider.nb}</span>
      </div>
    </div>
  )

  const sidebarBottom = (
    <button className="nav-item" style={{ color:'rgba(251,113,133,0.8)' }} onClick={logout}>
      <LogOut size={15} /><span>Logout</span>
    </button>
  )

  const topbarRight = (
    <div style={{ display:'flex', alignItems:'center', gap:14 }}>
      {syncing
        ? <span style={{ fontSize:12, color:'rgba(100,116,139,0.6)', display:'flex', alignItems:'center', gap:6 }}><Spinner size={12} />Syncing</span>
        : lastSync && <span style={{ fontSize:11, color:'rgba(100,116,139,0.45)' }}>Synced {lastSync.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
      }
      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
        <ProgressRing value={weeklyHours} max={WEEKLY_LIMIT} size={34} strokeWidth={3}
          color={weeklyHours >= 50 ? '#f43f5e' : weeklyHours >= 40 ? '#f59e0b' : '#10b981'} />
        <div style={{ display:'flex', flexDirection:'column' }}>
          <span style={{ fontSize:12, fontWeight:700, fontFamily:"'JetBrains Mono',monospace", color:'#e1e7f5' }}>{weeklyHours}h<span style={{ color:'rgba(100,116,139,0.6)', fontWeight:400 }}> / {WEEKLY_LIMIT}h</span></span>
          <span style={{ fontSize:10, color:'rgba(100,116,139,0.6)' }}>this week</span>
        </div>
      </div>
    </div>
  )

  return (
    <>
      <Head><title>FleetOps — {rider.name}</title></Head>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <Layout navItems={navItems} activePage={page} onNav={p => setPage(p as any)}
        topbarRight={topbarRight} sidebarTop={sidebarTop} sidebarBottom={sidebarBottom}
        portalLabel="Rider" portalColor="#60a5fa">

        {/* ══ AVAILABLE SHIFTS ══════════════════════════════ */}
        {page === 'shifts' && (
          <div className="anim-fade">
            <div style={{ marginBottom:24 }}>
              <h1 className="page-title">Available Shifts</h1>
              <p className="page-sub">Select a date below and book your next shift</p>
            </div>

            {/* Hours meters */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:24 }}>
              {[
                { label:'Weekly Hours', val:weeklyHours, max:WEEKLY_LIMIT, left: WEEKLY_LIMIT - weeklyHours },
                { label:`Today's Hours`, val:dailyHours, max:DAILY_LIMIT, left: DAILY_LIMIT - dailyHours },
              ].map(m => {
                const pct  = Math.min(m.val / m.max * 100, 100)
                const col  = m.val >= m.max ? '#f43f5e' : m.val >= m.max * 0.8 ? '#f59e0b' : '#10b981'
                return (
                  <div key={m.label} className="glass-card" style={{ padding:'14px 16px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                      <span style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(100,116,139,0.8)' }}>{m.label}</span>
                      <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:col }}>{m.val}/{m.max}h</span>
                    </div>
                    <div className="progress-track">
                      <div className="progress-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg, ${col}bb, ${col})` }} />
                    </div>
                    <div style={{ fontSize:11, color:'rgba(100,116,139,0.6)', marginTop:7 }}>{Math.max(0, m.left).toFixed(1)}h remaining</div>
                  </div>
                )
              })}
            </div>

            {/* Date tabs */}
            <div className="date-tabs" style={{ marginBottom:24 }}>
              {getNext7Days().map((d, i) => {
                const dk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
                const active = selectedDate === dk
                const hasShifts = shifts.some(s => s.date === dk)
                return (
                  <button key={dk} onClick={() => setSelectedDate(dk)} className={`date-tab ${active ? 'active' : ''}`}>
                    <div className="date-tab-day">{i === 0 ? 'Today' : DAYS[d.getDay()]}</div>
                    <div className="date-tab-num">{d.getDate()}</div>
                    {hasShifts && <div style={{ width:5, height:5, borderRadius:'50%', background: active ? '#60a5fa' : 'rgba(100,116,139,0.4)', margin:'4px auto 0' }} />}
                  </button>
                )
              })}
            </div>

            {/* Shift date header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
              <h2 style={{ fontSize:15, fontWeight:700, color:'#e1e7f5' }}>{fmtDate(selectedDate)}</h2>
              <span style={{ fontSize:12, color:'rgba(100,116,139,0.6)' }}>{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''}</span>
            </div>

            {/* Shift grid */}
            {loading && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px,1fr))', gap:14 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} style={{ height:220 }} />)}
              </div>
            )}
            {!loading && dayShifts.length === 0 && (
              <EmptyState icon={CalendarDays} title="No shifts available" description="No shifts are scheduled for this date. Try selecting another day." />
            )}
            {!loading && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(270px,1fr))', gap:14 }}>
                {dayShifts.map(s => {
                  const pct = Math.round(s.booked / s.capacity * 100)
                  const fillClass = pct >= 100 ? 'cap-high' : pct >= 70 ? 'cap-mid' : 'cap-low'
                  const isBooked  = bookedIds.has(s.id)
                  const isFull    = s.booked >= s.capacity
                  const myBk      = myConfirmed.find(b => b.shiftId === s.id)
                  const exceedsD  = !isBooked && dailyHours + s.hours > DAILY_LIMIT
                  const exceedsW  = !isBooked && weeklyHours + s.hours > WEEKLY_LIMIT
                  const blocked   = exceedsD || exceedsW
                  const isSuccess = successId === s.id

                  return (
                    <div key={s.id} className={`shift-card ${isBooked ? 'shift-booked' : ''} ${isFull && !isBooked ? 'shift-full' : ''}`}
                      style={isSuccess ? { borderColor:'rgba(16,185,129,0.4)', boxShadow:'0 0 24px rgba(16,185,129,0.15)' } : {}}>

                      {/* top accent bar */}
                      <div style={{ height:2, background: isBooked ? 'linear-gradient(90deg,#2563eb,transparent)' : isFull ? 'rgba(255,255,255,0.07)' : 'linear-gradient(90deg,#059669,transparent)' }} />

                      <div style={{ padding:'16px 18px' }}>
                        {/* Header row */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                          <div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:17, fontWeight:700, color:'#f1f5ff', marginBottom:3 }}>
                              {fmt12(s.start)} – {fmt12(s.end)}
                            </div>
                            <div style={{ fontSize:12, color:'rgba(100,116,139,0.75)', display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ display:'flex', alignItems:'center', gap:3 }}><Timer size={11} /> {s.hours}h</span>
                              <span style={{ display:'flex', alignItems:'center', gap:3 }}><MapPin size={11} /> {s.notes}</span>
                            </div>
                          </div>
                          <span className={`badge ${isBooked?'badge-blue':isFull?'badge-red':blocked?'badge-amber':'badge-green'}`}>
                            {isBooked?'Booked':isFull?'Full':blocked?'Limit':'Open'}
                          </span>
                        </div>

                        {/* Capacity bar */}
                        <div className="cap-bar"><div className={`cap-fill ${fillClass}`} style={{ width:`${Math.min(pct,100)}%` }} /></div>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'rgba(100,116,139,0.65)', marginBottom:14 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:4 }}><Users size={10} /> {s.booked}/{s.capacity} slots</span>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color: pct>=100?'#fb7185':pct>=70?'#fcd34d':'#6ee7b7' }}>{pct}%</span>
                        </div>

                        {/* Surge indicator */}
                        {pct >= 80 && !isFull && !isBooked && (
                          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#fcd34d', marginBottom:12 }}>
                            <Flame size={11} /> Filling fast
                          </div>
                        )}

                        {/* CTA */}
                        {!isBooked && !isFull && !blocked && (
                          <button onClick={() => bookShift(s.id)} disabled={loading}
                            className={isSuccess ? 'btn-success' : 'btn-primary'}
                            style={{ width:'100%', justifyContent:'center', padding:'10px', borderRadius:12 }}>
                            {isSuccess ? <><CheckCircle size={15} /> Booked!</> : loading ? <><Spinner size={14} /> Booking...</> : <>Book This Shift <ChevronRight size={14} /></>}
                          </button>
                        )}
                        {!isBooked && !isFull && blocked && (
                          <div style={{ width:'100%', padding:'9px', borderRadius:12, fontSize:12, fontWeight:600, color:'#fcd34d', background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.2)', textAlign:'center' }}>
                            <AlertTriangle size={12} style={{ display:'inline', marginRight:5 }} />
                            {exceedsD ? `${(DAILY_LIMIT-dailyHours).toFixed(1)}h left today` : `${(WEEKLY_LIMIT-weeklyHours).toFixed(1)}h left this week`}
                          </div>
                        )}
                        {isBooked && myBk && (
                          <button onClick={() => setCancelModal({ bookingId:myBk.id, reason:'' })}
                            className="btn-danger" style={{ width:'100%', justifyContent:'center', padding:'10px', borderRadius:12 }}>
                            <XCircle size={14} /> Cancel Booking
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ══ MY BOOKINGS ═══════════════════════════════════ */}
        {page === 'mybookings' && (
          <div className="anim-fade">
            <h1 className="page-title">My Bookings</h1>
            <p className="page-sub">Your complete booking history</p>

            {/* Summary row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:24 }}>
              {[
                { label:'Confirmed', val:myConfirmed.length, col:'#93c5fd' },
                { label:'Cancelled', val:myCancelled.length, col:'#fb7185' },
                { label:'This Week', val:`${weeklyHours}h`,  col:'#6ee7b7' },
              ].map(s => (
                <div key={s.label} className="glass-card" style={{ padding:'14px', textAlign:'center' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:24, fontWeight:700, color:s.col }}>{s.val}</div>
                  <div style={{ fontSize:11, color:'rgba(100,116,139,0.7)', marginTop:4, textTransform:'uppercase', letterSpacing:'0.08em' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {myBookings.length === 0 && <EmptyState icon={ClipboardList} title="No bookings yet" description="Book your first shift from Available Shifts." />}

            {/* Sort: Confirmed first, then by shiftDate asc */}
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {[...myBookings]
                .sort((a, b) => {
                  if (a.status !== b.status) return a.status === 'Confirmed' ? -1 : 1
                  const da = a.shiftDate ? a.shiftDate.split('.').reverse().join('-') : ''
                  const db = b.shiftDate ? b.shiftDate.split('.').reverse().join('-') : ''
                  if (da !== db) return da < db ? -1 : 1
                  return (a.startTime || '').localeCompare(b.startTime || '')
                })
                .map(b => {
                  // Use booking row fields directly — self-contained, no join needed
                  const conf = b.status === 'Confirmed'
                  // Also try to enrich from shifts array if available
                  const s = shifts.find(x => x.id === b.shiftId)
                  const displayDate  = b.shiftDate  || (s ? fmtDateFromISO(s.date) : '')
                  const displayDay   = b.day        || s?.day  || ''
                  const displayStart = b.startTime  || s?.start || ''
                  const displayEnd   = b.endTime    || s?.end   || ''
                  const displayHours = b.hours      || s?.hours || 0
                  const displayNotes = s?.notes     || b.shiftId
                  return (
                    <div key={b.id} className="glass-card" style={{ padding:'16px 18px', border: conf ? '1px solid rgba(59,130,246,0.18)' : '1px solid rgba(244,63,94,0.18)', opacity: conf ? 1 : 0.8 }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                          <div style={{ width:42, height:42, borderRadius:12, background: conf ? 'rgba(37,99,235,0.18)' : 'rgba(244,63,94,0.12)', display:'flex', alignItems:'center', justifyContent:'center', color: conf ? '#93c5fd' : '#fb7185', flexShrink:0 }}>
                            <CalendarDays size={18} />
                          </div>
                          <div>
                            {/* Primary: time range */}
                            <div style={{ fontWeight:700, fontSize:14.5, color:'#f1f5ff', fontFamily:"'JetBrains Mono',monospace" }}>
                              {displayStart ? `${fmt12(displayStart)} – ${fmt12(displayEnd)}` : b.shiftId}
                            </div>
                            {/* Secondary: date + day + hours */}
                            <div style={{ fontSize:12, color:'rgba(148,163,184,0.75)', marginTop:3, display:'flex', flexWrap:'wrap', gap:8 }}>
                              {displayDate && <span style={{ display:'flex', alignItems:'center', gap:3 }}><CalendarDays size={11} /> {displayDate}</span>}
                              {displayDay  && <span>· {displayDay}</span>}
                              {displayHours > 0 && <span>· {displayHours}h</span>}
                            </div>
                            {/* Tertiary: shift ID + notes */}
                            <div style={{ fontSize:11, color:'rgba(100,116,139,0.55)', marginTop:3 }}>
                              {b.shiftId} {displayNotes !== b.shiftId ? `· ${displayNotes}` : ''}
                            </div>
                            {/* Cancel reason */}
                            {b.cancelReason && (
                              <div style={{ fontSize:11, color:'#fb7185', marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                                <XCircle size={11} /> {b.cancelReason}
                              </div>
                            )}
                          </div>
                        </div>
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
                          <span className={`badge ${conf ? 'badge-blue' : 'badge-red'}`}>{b.status}</span>
                          {conf && myCancelled.length < 5 && (
                            <button onClick={() => setCancelModal({ bookingId:b.id, reason:'' })} className="btn-danger btn-xs">
                              <XCircle size={12} /> Cancel
                            </button>
                          )}
                          {conf && myCancelled.length >= 5 && (
                            <span style={{ fontSize:11, color:'rgba(244,63,94,0.5)', padding:'4px 8px' }}>Limit reached</span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        )}

        {/* ══ UPCOMING ══════════════════════════════════════ */}
        {page === 'upcoming' && (
          <div className="anim-fade">
            <h1 className="page-title">Upcoming Shifts</h1>
            <p className="page-sub">Your confirmed schedule going forward</p>


            {myConfirmed.filter(b => {
              const s = shifts.find(x => x.id === b.shiftId)
              const dateISO = b.shiftDate ? toISO(b.shiftDate) : (s ? toISO(s.date) : '')
              if (!dateISO) return true
              const today = new Date(); today.setHours(0,0,0,0)
              return new Date(dateISO+'T00:00:00') >= today
            }).length === 0 && <EmptyState icon={Clock} title="No upcoming shifts" description="You have no confirmed future shifts. Book one from Available Shifts." />}

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {[...myConfirmed]
                .filter(b => {
                  const s = shifts.find(x => x.id === b.shiftId)
                  const dateISO = b.shiftDate ? toISO(b.shiftDate) : (s ? toISO(s.date) : '')
                  if (!dateISO) return true
                  const today = new Date(); today.setHours(0,0,0,0)
                  return new Date(dateISO+'T00:00:00') >= today
                })
                .sort((a, b2) => {
                  const sa = shifts.find(x => x.id === a.shiftId)
                  const sb = shifts.find(x => x.id === b2.shiftId)
                  const da = a.shiftDate ? a.shiftDate.split('.').reverse().join('-') : (sa?.date||'')
                  const db = b2.shiftDate ? b2.shiftDate.split('.').reverse().join('-') : (sb?.date||'')
                  if (da !== db) return da < db ? -1 : 1
                  return (a.startTime||'').localeCompare(b2.startTime||'')
                })
                .map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                // Prefer booking row fields; fall back to shift sheet
                const displayStart = b.startTime  || s?.start || ''
                const displayEnd   = b.endTime    || s?.end   || ''
                const displayDate  = b.shiftDate  || (s ? fmtDateFromISO(s.date) : '')
                const displayDay   = b.day        || s?.day   || ''
                const displayHours = b.hours      || s?.hours || 0
                const displayNotes = s?.notes     || ''
                return (
                  <div key={b.id} className="glass-card" style={{ padding:'20px 22px', border:'1px solid rgba(59,130,246,0.15)' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:12 }}>
                      <div>
                        {/* Time range — always from booking row */}
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:22, fontWeight:700, color:'#f1f5ff', marginBottom:4 }}>
                          {displayStart ? `${fmt12(displayStart)} – ${fmt12(displayEnd)}` : b.shiftId}
                        </div>
                        {/* Date / Day / Notes */}
                        <div style={{ fontSize:13, color:'rgba(100,116,139,0.8)', marginBottom:14, display:'flex', flexWrap:'wrap', gap:6 }}>
                          {displayDate && <span>{displayDate}</span>}
                          {displayDay  && <span>· {displayDay}</span>}
                          {displayNotes && <span>· {displayNotes}</span>}
                        </div>
                        {/* Hours / riders */}
                        <div style={{ display:'flex', gap:16, fontSize:13, color:'rgba(148,163,184,0.75)' }}>
                          {displayHours > 0 && <span style={{ display:'flex', alignItems:'center', gap:5 }}><Timer size={13} color="#60a5fa" /> {displayHours}h shift</span>}
                          {s && <span style={{ display:'flex', alignItems:'center', gap:5 }}><Users size={13} color="#a78bfa" /> {s.booked}/{s.capacity} riders</span>}
                        </div>
                      </div>
                      <span className="badge badge-green" style={{ display:'flex', alignItems:'center', gap:5 }}>
                        <span className="live-pulse" style={{ width:6, height:6 }}>
                          <span className="live-pulse-dot" style={{ width:6, height:6 }} />
                          <span className="live-pulse-ring" style={{ inset:-2 }} />
                        </span>
                        Upcoming
                      </span>
                    </div>
                    <div className="divider" />
                    <div style={{ fontSize:12, color:'#93c5fd', display:'flex', alignItems:'center', gap:6, padding:'10px 14px', background:'rgba(37,99,235,0.08)', borderRadius:10, border:'1px solid rgba(59,130,246,0.15)' }}>
                      <Bell size={13} style={{ flexShrink:0 }} />
                      <span>Email &amp; SMS reminder will be sent 1 hour before your shift starts</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ NOTIFICATIONS ═════════════════════════════════ */}
        {page === 'notifications' && (
          <div className="anim-fade">
            <h1 className="page-title">Notifications</h1>
            <p className="page-sub">Reminders, alerts and your weekly status</p>

            {/* Weekly ring card */}
            <div className="glass-card" style={{ padding:'22px', marginBottom:14, display:'flex', alignItems:'center', gap:20, border:'1px solid rgba(255,255,255,0.07)' }}>
              <ProgressRing value={weeklyHours} max={WEEKLY_LIMIT} size={80} strokeWidth={7}
                color={weeklyHours >= WEEKLY_LIMIT ? '#f43f5e' : weeklyHours >= 45 ? '#f59e0b' : '#10b981'}
                label={`${weeklyHours}h`} sublabel={`/ ${WEEKLY_LIMIT}h`} />
              <div>
                <div style={{ fontWeight:700, fontSize:15, color:'#f1f5ff', marginBottom:4 }}>Weekly Hours Status</div>
                <div style={{ fontSize:13, color:'rgba(100,116,139,0.8)', marginBottom:8 }}>{Math.max(0, WEEKLY_LIMIT - weeklyHours)}h remaining this week</div>
                <div style={{ fontSize:12, color:'rgba(100,116,139,0.55)' }}>
                  Limits: <strong style={{ color:'rgba(148,163,184,0.7)' }}>{WEEKLY_LIMIT}h/week</strong> · <strong style={{ color:'rgba(148,163,184,0.7)' }}>{DAILY_LIMIT}h/day</strong> · <strong style={{ color:'rgba(148,163,184,0.7)' }}>5 cancels/week</strong>
                </div>
              </div>
            </div>

            {/* Cancellation warning */}
            {myCancelled.length > 0 && (
              <div className="alert alert-warning" style={{ marginBottom:12 }}>
                <AlertTriangle size={15} style={{ flexShrink:0 }} />
                <span>You have used <strong>{weeklyCancels}/5</strong> cancellations this week. {weeklyCancels >= 4 && 'Warning: approaching limit.'}</span>
              </div>
            )}

            {/* Upcoming shift reminders */}
            {myConfirmed.length === 0 && (
              <div className="alert alert-info"><Bell size={14} style={{ flexShrink:0 }} /> No upcoming shifts. Book a shift to get reminders.</div>
            )}
            {myConfirmed.map(b => {
              const s = shifts.find(x => x.id === b.shiftId)
              if (!s) return null
              return (
                <div key={b.id} style={{ display:'flex', alignItems:'flex-start', gap:14, padding:'14px 16px', background:'rgba(37,99,235,0.07)', border:'1px solid rgba(59,130,246,0.18)', borderRadius:14, marginBottom:10 }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:'rgba(37,99,235,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <Bell size={16} color="#93c5fd" />
                  </div>
                  <div>
                    <div style={{ fontWeight:600, fontSize:13.5, color:'#e1e7f5', marginBottom:3 }}>Shift Reminder — {fmtDate(s.date)}</div>
                    <div style={{ fontSize:12, color:'rgba(100,116,139,0.75)' }}>{fmt12(s.start)} – {fmt12(s.end)} · {s.notes}</div>
                    <div style={{ fontSize:12, color:'#6ee7b7', marginTop:6, display:'flex', alignItems:'center', gap:4 }}>
                      <CheckCircle size={11} /> Notification scheduled 1 hour before start
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Layout>

      {/* Cancel modal */}
      {cancelModal && (
        <Modal title="Cancel Booking" subtitle="This is recorded and counts toward your weekly limit" onClose={() => setCancelModal(null)}>
          {weeklyCancels >= 3 && (
            <div className="alert alert-warning" style={{ marginBottom:16 }}>
              <AlertTriangle size={14} style={{ flexShrink:0 }} />
              <span><strong>{5 - myCancelled.length}</strong> cancellation{5-myCancelled.length!==1?'s':''} remaining this week</span>
            </div>
          )}
          <div style={{ marginBottom:20 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:8 }}>Reason for cancellation</label>
            <select className="input-field" value={cancelModal.reason} onChange={e => setCancelModal({ ...cancelModal, reason: e.target.value })}>
              <option value="">Select a reason...</option>
              <option>Personal emergency</option>
              <option>Vehicle issue</option>
              <option>Medical appointment</option>
              <option>Family matter</option>
              <option>Work conflict</option>
              <option>Other</option>
            </select>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn-ghost" onClick={() => setCancelModal(null)}>Keep Booking</button>
            <button className="btn-danger" onClick={cancelBooking} disabled={loading}>
              {loading ? <Spinner size={14} /> : <XCircle size={15} />} Confirm Cancel
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
