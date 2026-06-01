import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import {
  CalendarDays, ClipboardList, Clock, Bell, LogOut, Zap,
  CheckCircle, XCircle, ChevronRight, TrendingUp, AlertTriangle,
  RefreshCw, MapPin, Timer, Users, Star, Flame, Shield,
  ArrowRight, Calendar, Activity
} from 'lucide-react'
import { Spinner, Toast, Modal, ProgressRing, EmptyState, Avatar, Skeleton, KpiCard } from '../components/ui'
import Layout from '../components/Layout'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const WEEKLY_LIMIT = 56
const DAILY_LIMIT = 8

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(); d.setDate(d.getDate() + i); return d })
}
function getWeekMonday() {
  const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); d.setHours(0,0,0,0); return d
}
function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}
function formatDate(d: string) {
  const date = new Date(d)
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`
}

type Rider = { nb: string; name: string; email: string; phone: string }
type Shift = { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; booked: number; status: string; notes: string }
type Booking = {
  id: string; riderNb: string; riderName?: string; shiftId: string
  date?: string; day?: string; startTime?: string; endTime?: string
  hours?: number; status: string; cancelReason: string; bookedAt?: string
}

export default function RiderPortal() {
  const [rider, setRider] = useState<Rider | null>(null)
  const [page, setPage] = useState<'shifts'|'mybookings'|'upcoming'|'notifications'>('shifts')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [toast, setToast] = useState<{type:any;message:string}|null>(null)
  const [cancelModal, setCancelModal] = useState<{bookingId:string;reason:string}|null>(null)
  const [nb, setNb] = useState('')
  const [contact, setContact] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [bookingSuccess, setBookingSuccess] = useState<string|null>(null)

  const showToast = (type: any, message: string) => setToast({ type, message })

  const loadData = useCallback(async (silent = false) => {
    if (!rider) return
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [sRes, bRes] = await Promise.all([fetch('/api/shifts'), fetch('/api/bookings')])
      if (sRes.ok) setShifts(await sRes.json())
      if (bRes.ok) setBookings(await bRes.json())
    } finally { setLoading(false); setSyncing(false) }
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
      const res = await fetch('/api/auth/rider-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nb, contact })
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
      const res = await fetch('/api/bookings', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shiftId })
      })
      const data = await res.json()
      if (!res.ok) { showToast('error', data.error); return }
      setBookingSuccess(shiftId)
      setTimeout(() => setBookingSuccess(null), 3000)
      showToast('success', `Shift booked! ${data.weeklyRemaining}h remaining this week.`)
      await loadData(true)
    } finally { setLoading(false) }
  }

  async function cancelBooking() {
    if (!cancelModal?.reason) { showToast('warning', 'Please select a reason'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancelModal.bookingId, reason: cancelModal.reason })
      })
      const data = await res.json()
      if (!res.ok) { showToast('error', data.error); return }
      showToast('success', 'Booking cancelled successfully')
      setCancelModal(null); await loadData(true)
    } finally { setLoading(false) }
  }

  const myBookings = bookings.filter(b => b.riderNb === rider?.nb)
  const myConfirmed = myBookings.filter(b => b.status === 'Confirmed')
  const myCancelled = myBookings.filter(b => b.status === 'Cancelled')
  const bookedShiftIds = new Set(myConfirmed.map(b => b.shiftId))
  const monday = getWeekMonday()
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const weeklyShifts = myConfirmed.map(b => shifts.find(s => s.id === b.shiftId)).filter(s => s && new Date(s.date) >= monday && new Date(s.date) <= sunday) as Shift[]
  const weeklyHours = parseFloat(weeklyShifts.reduce((a, s) => a + s.hours, 0).toFixed(1))
  const dailyShifts = myConfirmed.map(b => shifts.find(s => s.id === b.shiftId)).filter(s => s?.date === selectedDate) as Shift[]
  const dailyHours = parseFloat(dailyShifts.reduce((a, s) => a + s.hours, 0).toFixed(1))
  const dayShifts = shifts.filter(s => s.date === selectedDate)

  // ── LOGIN SCREEN ──────────────────────────────────────────
  if (!rider) {
    return (
      <>
        <Head><title>FleetOps — Rider Login</title></Head>
        <div className="min-h-screen flex items-center justify-center bg-navy-950 bg-grid-pattern relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative w-full max-w-md mx-4 animate-slide-up">
            <div className="glass-card border border-white/10 p-8 shadow-modal">
              {/* Header */}
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-blue-600 flex items-center justify-center shadow-glow-blue">
                  <Zap size={20} className="text-white" fill="white" />
                </div>
                <div>
                  <div className="font-bold text-white text-lg mono tracking-tight">FleetOps</div>
                  <div className="text-xs text-blue-400 font-medium">Rider Portal</div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Welcome back</h1>
              <p className="text-slate-400 text-sm mb-7">Sign in with your NB number and contact details</p>
              {loginErr && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm mb-5">
                  <XCircle size={16} className="flex-shrink-0" /> {loginErr}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">NB Number</label>
                  <input className="input-field" placeholder="e.g. NB1001" value={nb} onChange={e => setNb(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email or Phone</label>
                  <input className="input-field" placeholder="your@email.com or +44..." value={contact} onChange={e => setContact(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
                </div>
                <button className="btn-primary w-full justify-center py-3 mt-2 rounded-2xl text-base" onClick={login} disabled={loginLoading}>
                  {loginLoading ? <><Spinner size={16} /> Signing in...</> : <>Sign In <ArrowRight size={16} /></>}
                </button>
              </div>
              <p className="text-center text-xs text-slate-600 mt-6">Contact your admin if you need access</p>
            </div>
          </div>
        </div>
      </>
    )
  }

  // ── NAV ITEMS ─────────────────────────────────────────────
  const navItems = [
    { id: 'shifts', label: 'Available Shifts', icon: CalendarDays },
    { id: 'mybookings', label: 'My Bookings', icon: ClipboardList },
    { id: 'upcoming', label: 'Upcoming', icon: Clock },
    { id: 'notifications', label: 'Notifications', icon: Bell, badge: myCancelled.length > 0 ? myCancelled.length : undefined },
  ]

  const sidebarTop = (
    <div className="flex items-center gap-2.5 p-2 rounded-xl bg-white/5 border border-white/10">
      <Avatar name={rider.name} size="sm" />
      <div className="min-w-0">
        <div className="font-semibold text-white text-xs truncate">{rider.name}</div>
        <div className="text-slate-500 text-xs mono truncate">{rider.nb}</div>
      </div>
    </div>
  )

  const sidebarBottom = (
    <button className="nav-item text-slate-500 hover:text-rose-400" onClick={logout}>
      <LogOut size={16} /><span>Logout</span>
    </button>
  )

  const topbarRight = (
    <div className="flex items-center gap-3">
      {syncing && <span className="text-xs text-slate-500 flex items-center gap-1.5"><Spinner size={12} /> Syncing</span>}
      <div className="flex items-center gap-2">
        <ProgressRing value={weeklyHours} max={WEEKLY_LIMIT} size={32} strokeWidth={3}
          color={weeklyHours >= 50 ? '#f43f5e' : weeklyHours >= 40 ? '#f59e0b' : '#10b981'} />
        <div className="hidden sm:block">
          <div className="text-xs font-semibold text-white mono">{weeklyHours}h <span className="text-slate-500 font-normal">/ {WEEKLY_LIMIT}h</span></div>
          <div className="text-xs text-slate-500">this week</div>
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
        portalLabel="Rider Portal" portalColor="#60a5fa">

        {/* ── AVAILABLE SHIFTS ── */}
        {page === 'shifts' && (
          <div className="animate-fade-in">
            <div className="mb-6">
              <h1 className="page-title">Available Shifts</h1>
              <p className="page-sub">Select a date and book your next shift</p>
            </div>

            {/* Hours Summary */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="glass-card p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weekly Hours</span>
                  <span className={`text-xs font-bold mono ${weeklyHours >= WEEKLY_LIMIT ? 'text-rose-400' : weeklyHours >= 45 ? 'text-amber-400' : 'text-emerald-400'}`}>{weeklyHours}/{WEEKLY_LIMIT}h</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(weeklyHours/WEEKLY_LIMIT*100,100)}%`, background: weeklyHours >= WEEKLY_LIMIT ? '#f43f5e' : weeklyHours >= 45 ? '#f59e0b' : '#10b981' }} />
                </div>
                <div className="text-xs text-slate-500 mt-2">{Math.max(0, WEEKLY_LIMIT - weeklyHours)}h remaining</div>
              </div>
              <div className="glass-card p-4 border border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Today's Hours</span>
                  <span className={`text-xs font-bold mono ${dailyHours >= DAILY_LIMIT ? 'text-rose-400' : dailyHours >= 6 ? 'text-amber-400' : 'text-emerald-400'}`}>{dailyHours}/{DAILY_LIMIT}h</span>
                </div>
                <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700" style={{ width: `${Math.min(dailyHours/DAILY_LIMIT*100,100)}%`, background: dailyHours >= DAILY_LIMIT ? '#f43f5e' : dailyHours >= 6 ? '#f59e0b' : '#10b981' }} />
                </div>
                <div className="text-xs text-slate-500 mt-2">{Math.max(0, DAILY_LIMIT - dailyHours)}h remaining today</div>
              </div>
            </div>

            {/* Date Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
              {getNext7Days().map((d, i) => {
                const dk = d.toISOString().split('T')[0]
                const isActive = selectedDate === dk
                const hasShifts = shifts.filter(s => s.date === dk).length > 0
                return (
                  <button key={dk} onClick={() => setSelectedDate(dk)}
                    className={`flex-shrink-0 flex flex-col items-center px-4 py-3 rounded-2xl border transition-all duration-200 min-w-[64px] ${
                      isActive ? 'bg-blue-600/20 border-blue-500/40 text-white' : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white'
                    }`}>
                    <span className={`text-xs font-medium mb-1 ${isActive ? 'text-blue-400' : ''}`}>{i === 0 ? 'Today' : DAYS[d.getDay()]}</span>
                    <span className={`text-lg font-bold mono ${isActive ? 'text-white' : ''}`}>{d.getDate()}</span>
                    {hasShifts && <div className={`w-1.5 h-1.5 rounded-full mt-1 ${isActive ? 'bg-blue-400' : 'bg-slate-600'}`} />}
                  </button>
                )
              })}
            </div>

            {/* Shift date header */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-white text-base">{formatDate(selectedDate)}</h2>
              <span className="text-xs text-slate-500">{dayShifts.length} shift{dayShifts.length !== 1 ? 's' : ''} available</span>
            </div>

            {loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <Skeleton key={i} className="h-52" />)}
              </div>
            )}

            {!loading && dayShifts.length === 0 && (
              <EmptyState icon={CalendarDays} title="No shifts scheduled" description="No shifts are available for this date. Check back later or select another date." />
            )}

            {!loading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {dayShifts.map(s => {
                  const pct = Math.round(s.booked / s.capacity * 100)
                  const isBooked = bookedShiftIds.has(s.id)
                  const isFull = s.booked >= s.capacity
                  const myBk = myConfirmed.find(b => b.shiftId === s.id)
                  const wouldExceedDaily = !isBooked && dailyHours + s.hours > DAILY_LIMIT
                  const wouldExceedWeekly = !isBooked && weeklyHours + s.hours > WEEKLY_LIMIT
                  const blocked = wouldExceedDaily || wouldExceedWeekly
                  const isSuccess = bookingSuccess === s.id
                  return (
                    <div key={s.id} className={`glass-card border transition-all duration-300 overflow-hidden ${
                      isBooked ? 'border-blue-500/30 bg-blue-600/5' :
                      isFull ? 'border-white/5 opacity-60' :
                      blocked ? 'border-amber-500/20' :
                      isSuccess ? 'border-emerald-500/40 bg-emerald-500/5 shadow-glow-emerald' :
                      'border-white/10 hover:border-white/20 hover:shadow-card-hover'
                    }`}>
                      {/* Top accent line */}
                      <div className={`h-0.5 w-full ${isBooked ? 'bg-gradient-to-r from-blue-500 to-blue-600/0' : isFull ? 'bg-white/10' : blocked ? 'bg-amber-500/40' : 'bg-gradient-to-r from-emerald-500/60 to-emerald-500/0'}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="font-bold text-white text-xl mono tracking-tight">{formatTime(s.start)} – {formatTime(s.end)}</div>
                            <div className="text-slate-400 text-xs mt-1 flex items-center gap-2">
                              <Timer size={11} /> {s.hours}h shift
                              <MapPin size={11} className="ml-1" /> {s.notes}
                            </div>
                          </div>
                          <span className={`${isBooked ? 'badge-blue' : isFull ? 'badge-red' : blocked ? 'badge-amber' : 'badge-green'}`}>
                            {isBooked ? 'Booked' : isFull ? 'Full' : blocked ? 'Limit' : 'Open'}
                          </span>
                        </div>

                        {/* Capacity */}
                        <div className="mb-4">
                          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                            <span className="flex items-center gap-1"><Users size={11} /> {s.booked}/{s.capacity} slots</span>
                            <span className={`font-semibold mono ${pct >= 100 ? 'text-rose-400' : pct >= 70 ? 'text-amber-400' : 'text-emerald-400'}`}>{pct}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width:`${Math.min(pct,100)}%`, background: pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981' }} />
                          </div>
                        </div>

                        {/* Shift ID */}
                        <div className="flex items-center justify-between mb-4">
                          <span className="text-xs text-slate-600 mono">{s.id}</span>
                          {pct >= 80 && !isFull && !isBooked && (
                            <span className="flex items-center gap-1 text-xs text-amber-400"><Flame size={11} /> Filling fast</span>
                          )}
                        </div>

                        {/* CTA */}
                        {!isBooked && !isFull && !blocked && (
                          <button onClick={() => bookShift(s.id)} disabled={loading}
                            className={`w-full justify-center py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 flex items-center gap-2 ${
                              isSuccess
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-glow-blue active:scale-98'
                            }`}>
                            {isSuccess ? <><CheckCircle size={15} /> Booked!</> : loading ? <><Spinner size={14} /> Booking...</> : <>Book Shift <ChevronRight size={15} /></>}
                          </button>
                        )}
                        {!isBooked && !isFull && blocked && (
                          <div className="w-full py-2.5 rounded-xl text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 flex items-center justify-center gap-1.5">
                            <AlertTriangle size={13} />
                            {wouldExceedDaily ? `Daily limit: ${(DAILY_LIMIT - dailyHours).toFixed(1)}h left today` : `Weekly limit: ${(WEEKLY_LIMIT - weeklyHours).toFixed(1)}h left`}
                          </div>
                        )}
                        {isBooked && myBk && (
                          <button onClick={() => setCancelModal({ bookingId: myBk.id, reason: '' })}
                            className="w-full justify-center py-2.5 rounded-xl text-sm font-medium btn-danger">
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

        {/* ── MY BOOKINGS ── */}
        {page === 'mybookings' && (
          <div className="animate-fade-in">
            <h1 className="page-title">My Bookings</h1>
            <p className="page-sub">Your complete booking history</p>
            <div className="flex gap-3 mb-6">
              <div className="glass-card border border-white/10 px-4 py-3 text-center flex-1">
                <div className="text-2xl font-bold mono text-blue-400">{myConfirmed.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">Confirmed</div>
              </div>
              <div className="glass-card border border-white/10 px-4 py-3 text-center flex-1">
                <div className="text-2xl font-bold mono text-rose-400">{myCancelled.length}</div>
                <div className="text-xs text-slate-500 mt-0.5">Cancelled</div>
              </div>
              <div className="glass-card border border-white/10 px-4 py-3 text-center flex-1">
                <div className="text-2xl font-bold mono text-emerald-400">{weeklyHours}h</div>
                <div className="text-xs text-slate-500 mt-0.5">This Week</div>
              </div>
            </div>
            {myBookings.length === 0 && <EmptyState icon={ClipboardList} title="No bookings yet" description="Book your first shift from the Available Shifts page." />}
            <div className="space-y-3">
              {myBookings.map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                const confirmed = b.status === 'Confirmed'
                return (
                  <div key={b.id} className={`glass-card border p-4 transition-all duration-200 ${confirmed ? 'border-blue-500/15' : 'border-white/5 opacity-75'}`}>
                    <div className="flex items-center justify-between flex-wrap gap-3">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${confirmed ? 'bg-blue-500/15 text-blue-400' : 'bg-white/5 text-slate-500'}`}>
                          <CalendarDays size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-white text-sm">{s ? `${formatTime(s.start)} – ${formatTime(s.end)}` : b.shiftId}</div>
                          <div className="text-xs text-slate-400 mt-0.5">{s ? formatDate(s.date) : ''} {s ? `· ${s.notes}` : ''}</div>
                          {b.cancelReason && <div className="text-xs text-rose-400 mt-1 flex items-center gap-1"><XCircle size={11} /> {b.cancelReason}</div>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={confirmed ? 'badge-blue' : 'badge-red'}>{b.status}</span>
                        {confirmed && (
                          <button onClick={() => setCancelModal({ bookingId: b.id, reason: '' })}
                            className="btn-danger py-1.5 px-3 text-xs">
                            <XCircle size={13} /> Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── UPCOMING ── */}
        {page === 'upcoming' && (
          <div className="animate-fade-in">
            <h1 className="page-title">Upcoming Shifts</h1>
            <p className="page-sub">Your confirmed schedule</p>
            {myConfirmed.length === 0 && <EmptyState icon={Clock} title="No upcoming shifts" description="You don't have any confirmed shifts. Book one from Available Shifts." />}
            <div className="space-y-4">
              {myConfirmed.map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                if (!s) return null
                return (
                  <div key={b.id} className="glass-card border border-white/10 p-5 hover:border-white/20 transition-all">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="font-bold text-white text-2xl mono tracking-tight">{formatTime(s.start)} – {formatTime(s.end)}</div>
                        <div className="text-slate-400 text-sm mt-1">{formatDate(s.date)} · {s.notes}</div>
                      </div>
                      <span className="badge-green flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" />
                        Upcoming
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mb-4">
                      <span className="flex items-center gap-1.5"><Timer size={14} className="text-blue-400" /> {s.hours}h shift</span>
                      <span className="flex items-center gap-1.5"><Users size={14} className="text-violet-400" /> {s.booked}/{s.capacity} riders</span>
                    </div>
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/10 border border-blue-500/15 text-xs text-blue-300">
                      <Bell size={13} className="flex-shrink-0" />
                      Email/SMS reminder will be sent 1 hour before your shift starts
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {page === 'notifications' && (
          <div className="animate-fade-in">
            <h1 className="page-title">Notifications</h1>
            <p className="page-sub">Alerts, reminders and limits</p>
            <div className="space-y-3">
              {/* Weekly progress card */}
              <div className="glass-card border border-white/10 p-5">
                <div className="flex items-center gap-4">
                  <ProgressRing value={weeklyHours} max={WEEKLY_LIMIT} size={72} strokeWidth={6}
                    color={weeklyHours >= WEEKLY_LIMIT ? '#f43f5e' : weeklyHours >= 45 ? '#f59e0b' : '#10b981'}
                    label={`${weeklyHours}h`} sublabel="/ 56h" />
                  <div>
                    <div className="font-semibold text-white mb-1">Weekly Hours Status</div>
                    <div className="text-sm text-slate-400">{Math.max(0, WEEKLY_LIMIT - weeklyHours)}h remaining this week</div>
                    <div className="text-xs text-slate-500 mt-2">Limits: {WEEKLY_LIMIT}h/week · {DAILY_LIMIT}h/day · 5 cancels/week</div>
                  </div>
                </div>
              </div>
              {/* Cancellation warning */}
              {myCancelled.length > 0 && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold">Cancellation usage: {myCancelled.length}/5 this week</div>
                    {myCancelled.length >= 4 && <div className="text-xs text-amber-400/80 mt-1">Warning: You are approaching your weekly cancellation limit.</div>}
                  </div>
                </div>
              )}
              {/* Reminders for upcoming shifts */}
              {myConfirmed.length === 0 && (
                <div className="flex items-start gap-3 p-4 rounded-2xl bg-white/5 border border-white/10 text-slate-400 text-sm">
                  <Bell size={16} className="flex-shrink-0 mt-0.5" /> No upcoming shift reminders. Book a shift to get notified.
                </div>
              )}
              {myConfirmed.map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                if (!s) return null
                return (
                  <div key={b.id} className="flex items-start gap-3 p-4 rounded-2xl bg-blue-500/10 border border-blue-500/15">
                    <div className="w-8 h-8 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Bell size={15} className="text-blue-400" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">Shift Reminder — {formatDate(s.date)}</div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatTime(s.start)} – {formatTime(s.end)} · {s.notes}</div>
                      <div className="text-xs text-blue-400 mt-1.5 flex items-center gap-1"><CheckCircle size={11} /> Notification scheduled for 1 hour before start</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </Layout>

      {/* Cancel Modal */}
      {cancelModal && (
        <Modal title="Cancel Booking" subtitle="This action is recorded and counts toward your weekly limit" onClose={() => setCancelModal(null)}>
          {myCancelled.length >= 4 && (
            <div className="flex items-center gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-sm mb-4">
              <AlertTriangle size={15} /> <strong>{5 - myCancelled.length}</strong> cancellation{5-myCancelled.length !== 1 ? 's' : ''} remaining this week
            </div>
          )}
          <div className="mb-5">
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2.5">Reason for cancellation</label>
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
          <div className="flex gap-3 justify-end">
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
