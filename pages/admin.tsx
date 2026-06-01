import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import {
  LayoutDashboard, Radio, Calendar, Receipt, Users, BarChart3,
  LogOut, Plus, Edit, Trash2, Copy, Download, RefreshCw,
  Shield, TrendingUp, Activity, Zap, Clock, AlertTriangle,
  CheckCircle, XCircle, Search, ChevronRight, Timer, MapPin,
  UserCheck, UserX, Eye
} from 'lucide-react'
import { Spinner, Toast, Modal, ProgressRing, EmptyState, Avatar, KpiCard, Skeleton } from '../components/ui'
import Layout from '../components/Layout'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function formatTime(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}
function formatDate(d: string) {
  const date = new Date(d + 'T00:00:00')
  return `${DAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`
}

type Rider = { nb: string; name: string; phone: string; email: string; active: boolean; weeklyHours: number; cancellations: number }
type Shift = { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; booked: number; status: string; notes: string }
type Booking = {
  id: string; riderNb: string; riderName: string; shiftId: string
  date: string; day: string; startTime: string; endTime: string
  hours: number; status: string; cancelReason: string; bookedAt: string
}

export default function AdminPortal() {
  const [authed, setAuthed] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [page, setPage] = useState<'dashboard'|'live'|'shifts'|'bookings'|'users'|'hours'>('dashboard')
  const [riders, setRiders] = useState<Rider[]>([])
  const [shifts, setShifts] = useState<Shift[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [lastSync, setLastSync] = useState<Date|null>(null)
  const [toast, setToast] = useState<{type:any;message:string}|null>(null)
  const [modal, setModal] = useState<null|'addRider'|'addShift'|'editShift'|'editRider'>(null)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [search, setSearch] = useState('')
  const [bookingFilter, setBookingFilter] = useState('')

  const showToast = (type: any, message: string) => setToast({ type, message })

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [rRes, sRes, bRes] = await Promise.all([fetch('/api/riders'), fetch('/api/shifts'), fetch('/api/bookings')])
      if (rRes.ok) setRiders(await rRes.json())
      if (sRes.ok) setShifts(await sRes.json())
      if (bRes.ok) setBookings(await bRes.json())
      setLastSync(new Date())
    } finally { setLoading(false); setSyncing(false) }
  }, [])

  useEffect(() => {
    if (!authed) return
    loadAll()
    const t = setInterval(() => loadAll(true), 20000)
    return () => clearInterval(t)
  }, [authed, loadAll])

  async function login() {
    setLoginLoading(true); setLoginErr('')
    try {
      const res = await fetch('/api/auth/admin-login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error || 'Invalid credentials'); return }
      setAuthed(true)
    } catch { setLoginErr('Network error') }
    finally { setLoginLoading(false) }
  }

  async function logout() { await fetch('/api/auth/logout', { method: 'POST' }); setAuthed(false) }

  async function addRider() {
    const res = await fetch('/api/riders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { showToast('error', data.error); return }
    showToast('success', `Rider ${form.nb} added successfully`); setModal(null); setForm({}); loadAll(true)
  }

  async function saveEditRider() {
    const res = await fetch('/api/riders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nb: editTarget.nb, ...form }) })
    if (!res.ok) { showToast('error', 'Failed to save'); return }
    showToast('success', 'Rider updated'); setModal(null); setForm({}); loadAll(true)
  }

  async function toggleRider(nb: string, active: boolean) {
    const res = await fetch('/api/riders', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nb, active }) })
    if (!res.ok) { showToast('error', 'Failed to update'); return }
    showToast('success', `Rider ${active ? 'activated' : 'disabled'}`); loadAll(true)
  }

  async function addShift() {
    if (!form.date || !form.start || !form.end) { showToast('error', 'Date, start and end required'); return }
    const res = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) })
    const data = await res.json()
    if (!res.ok) { showToast('error', data.error); return }
    showToast('success', `Shift ${data.id} created`); setModal(null); setForm({}); loadAll(true)
  }

  async function saveEditShift() {
    const res = await fetch('/api/shifts', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: editTarget.id, ...form }) })
    if (!res.ok) { showToast('error', 'Failed to save'); return }
    showToast('success', 'Shift updated'); setModal(null); setForm({}); loadAll(true)
  }

  async function deleteShift(id: string) {
    if (!confirm('Delete this shift? This cannot be undone.')) return
    const res = await fetch('/api/shifts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { showToast('error', 'Failed to delete'); return }
    showToast('success', 'Shift deleted'); loadAll(true)
  }

  async function duplicateShift(s: Shift) {
    const res = await fetch('/api/shifts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date: s.date, start: s.start, end: s.end, capacity: s.capacity, notes: s.notes }) })
    const data = await res.json()
    if (!res.ok) { showToast('error', data.error); return }
    showToast('success', `Duplicated as ${data.id}`); loadAll(true)
  }

  function exportCSV() {
    const rows = [['Booking_ID','Rider_NB','Rider_Name','Shift_ID','Date','Day','Start_Time','End_Time','Hours','Status','Cancel_Reason','Booked_At']]
    bookings.forEach(b => {
      rows.push([b.id, b.riderNb, b.riderName||'', b.shiftId, b.date||'', b.day||'', b.startTime||'', b.endTime||'', String(b.hours||''), b.status, b.cancelReason||'', b.bookedAt||''])
    })
    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = `fleetops_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    showToast('success', 'CSV exported')
  }

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const nowMins = now.getHours() * 60 + now.getMinutes()
  const toMins = (t: string) => { const [h,m]=t.split(':').map(Number); return h*60+m }
  const liveBookings = bookings.filter(b => {
    if (b.status !== 'Confirmed') return false
    const s = shifts.find(x => x.id === b.shiftId)
    if (!s || s.date !== todayStr) return false
    return nowMins >= toMins(s.start) && nowMins <= toMins(s.end)
  })

  const filteredRiders = riders.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.nb.toLowerCase().includes(search.toLowerCase()))
  const filteredBookings = bookings.filter(b => {
    const matchSearch = !search ||
      (b.riderName||'').toLowerCase().includes(search.toLowerCase()) ||
      (b.riderNb||'').toLowerCase().includes(search.toLowerCase()) ||
      (b.shiftId||'').toLowerCase().includes(search.toLowerCase()) ||
      (b.date||'').includes(search)
    const matchStatus = !bookingFilter || b.status === bookingFilter
    return matchSearch && matchStatus
  })

  const fulfillmentRate = shifts.length ? Math.round(shifts.filter(s => s.status === 'FULL').length / shifts.length * 100) : 0
  const totalCapacity = shifts.reduce((a, s) => a + s.capacity, 0)
  const totalBooked = shifts.reduce((a, s) => a + s.booked, 0)
  const utilizationRate = totalCapacity ? Math.round(totalBooked / totalCapacity * 100) : 0

  // ── LOGIN ─────────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <Head><title>FleetOps — Admin</title></Head>
        <div className="min-h-screen flex items-center justify-center bg-navy-950 bg-grid-pattern relative overflow-hidden">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="relative w-full max-w-md mx-4 animate-slide-up">
            <div className="glass-card border border-white/10 p-8 shadow-modal">
              <div className="flex items-center gap-3 mb-8">
                <div className="w-10 h-10 rounded-2xl bg-violet-600/80 flex items-center justify-center flex-shrink-0" style={{ boxShadow: '0 0 20px rgba(139,92,246,0.4)' }}>
                  <Shield size={20} className="text-white" />
                </div>
                <div>
                  <div className="font-bold text-white text-lg mono tracking-tight">FleetOps</div>
                  <div className="text-xs text-violet-400 font-medium">Admin Console</div>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-1">Admin Login</h1>
              <p className="text-slate-400 text-sm mb-7">Restricted access — authorised administrators only</p>
              {loginErr && (
                <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-300 text-sm mb-5">
                  <XCircle size={16} className="flex-shrink-0" /> {loginErr}
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label>
                  <input type="email" className="input-field" placeholder="admin@yourcompany.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
                  <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
                </div>
                <button className="w-full justify-center py-3 rounded-2xl text-base font-semibold text-white flex items-center gap-2 transition-all duration-200 mt-2"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)', boxShadow: '0 0 30px rgba(124,58,237,0.4)' }}
                  onClick={login} disabled={loginLoading}>
                  {loginLoading ? <><Spinner size={16} /> Signing in...</> : <><Shield size={16} /> Sign In to Admin</>}
                </button>
              </div>
              <div className="flex items-start gap-2 mt-6 p-3 rounded-xl bg-white/5 border border-white/10 text-xs text-slate-500">
                <Shield size={13} className="flex-shrink-0 mt-0.5" /> Riders access <span className="text-slate-400 font-mono mx-1">/rider</span> — they cannot reach this page.
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'live', label: 'Live Now', icon: Radio, badge: liveBookings.length > 0 ? liveBookings.length : undefined },
    { id: 'shifts', label: 'Shifts', icon: Calendar },
    { id: 'bookings', label: 'Bookings', icon: Receipt },
    { id: 'users', label: 'Riders', icon: Users },
    { id: 'hours', label: 'Hours', icon: BarChart3 },
  ]

  const sidebarBottom = (
    <>
      <button onClick={() => loadAll(true)} disabled={syncing} className="nav-item text-slate-500 hover:text-white mb-1">
        <RefreshCw size={16} className={syncing ? 'animate-spin' : ''} /><span>{syncing ? 'Syncing...' : 'Refresh Data'}</span>
      </button>
      <button className="nav-item text-slate-500 hover:text-rose-400" onClick={logout}>
        <LogOut size={16} /><span>Logout</span>
      </button>
    </>
  )

  const topbarRight = (
    <div className="flex items-center gap-3">
      {lastSync && <span className="text-xs text-slate-600 hidden sm:block">Synced {lastSync.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>}
      <span className="badge-red flex items-center gap-1.5">
        <Shield size={11} /> Admin
      </span>
      <button className="btn-ghost py-2 px-3" onClick={exportCSV}>
        <Download size={14} /> Export
      </button>
    </div>
  )

  return (
    <>
      <Head><title>FleetOps — Admin Console</title></Head>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <Layout navItems={navItems} activePage={page} onNav={p => setPage(p as any)}
        topbarRight={topbarRight} sidebarBottom={sidebarBottom}
        portalLabel="Admin Console" portalColor="#a78bfa">

        {/* ── DASHBOARD ── */}
        {page === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
              <div>
                <h1 className="page-title">Operations Dashboard</h1>
                <p className="text-slate-400 text-sm">{now.toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
              </div>
              {liveBookings.length > 0 && (
                <div className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-400 text-sm font-semibold cursor-pointer hover:bg-emerald-500/15 transition-all" onClick={() => setPage('live')}>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse-slow" />
                  {liveBookings.length} rider{liveBookings.length>1?'s':''} on shift now
                  <ChevronRight size={14} />
                </div>
              )}
            </div>

            {loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-28" />)}
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                <KpiCard label="Total Riders" value={riders.length} sub={`${riders.filter(r=>r.active).length} active`} color="blue" icon={Users} />
                <KpiCard label="Live Now" value={liveBookings.length} sub="on shift" color="emerald" icon={Activity} />
                <KpiCard label="Total Shifts" value={shifts.length} sub={`${shifts.filter(s=>s.status==='FULL').length} full`} color="violet" icon={Calendar} />
                <KpiCard label="Utilization" value={`${utilizationRate}%`} sub={`${totalBooked}/${totalCapacity} slots`} color="cyan" icon={TrendingUp} />
                <KpiCard label="Cancellations" value={bookings.filter(b=>b.status==='Cancelled').length} sub="this period" color="amber" icon={XCircle} />
                <KpiCard label="Open Slots" value={shifts.reduce((a,s)=>a+(s.capacity-s.booked),0)} sub="available now" color="rose" icon={Timer} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Recent activity */}
              <div className="glass-card border border-white/10 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-white">Recent Bookings</h3>
                  <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setPage('bookings')}>View all →</button>
                </div>
                <div className="space-y-3">
                  {bookings.slice(-6).reverse().map(b => {
                    const r = riders.find(x => x.nb === b.riderNb)
                    const s = shifts.find(x => x.id === b.shiftId)
                    return (
                      <div key={b.id} className="flex items-center gap-3">
                        <Avatar name={r?.name || b.riderNb} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{r?.name || b.riderNb}</div>
                          <div className="text-xs text-slate-500">{b.shiftId} · {s?.date || ''}</div>
                        </div>
                        <span className={b.status === 'Confirmed' ? 'badge-blue' : 'badge-red'}>{b.status}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Shift fill rates */}
              <div className="glass-card border border-white/10 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-white">Shift Fill Rates</h3>
                  <button className="text-xs text-blue-400 hover:text-blue-300" onClick={() => setPage('shifts')}>Manage →</button>
                </div>
                <div className="space-y-4">
                  {shifts.slice(0, 6).map(s => {
                    const pct = s.capacity > 0 ? Math.round(s.booked / s.capacity * 100) : 0
                    return (
                      <div key={s.id}>
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="text-slate-400">{s.id} · {formatTime(s.start)}–{formatTime(s.end)}</span>
                          <span className={`font-bold mono ${pct>=100?'text-rose-400':pct>=70?'text-amber-400':'text-emerald-400'}`}>{pct}%</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700" style={{ width:`${Math.min(pct,100)}%`, background: pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── LIVE NOW ── */}
        {page === 'live' && (
          <div className="animate-fade-in">
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="page-title">Live Active Riders</h1>
                <p className="page-sub">Riders currently on shift — auto-refreshes every 20s</p>
              </div>
              <div className="text-xs text-slate-500 mono">{now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
            </div>
            {liveBookings.length === 0 ? (
              <EmptyState icon={Radio} title="No active shifts" description={`No riders are currently on shift. Next check at ${new Date(Date.now()+20000).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}.`} />
            ) : (
              <>
                <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-6 text-emerald-300 text-sm font-medium">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 relative">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-50" />
                  </span>
                  {liveBookings.length} rider{liveBookings.length>1?'s':''} on shift as of {now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {liveBookings.map(b => {
                    const r = riders.find(x => x.nb === b.riderNb)
                    const s = shifts.find(x => x.id === b.shiftId)
                    return (
                      <div key={b.id} className="glass-card border border-emerald-500/15 bg-emerald-500/5 p-5">
                        <div className="flex items-start justify-between mb-4">
                          <Avatar name={r?.name || '?'} size="lg" />
                          <span className="badge-green flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse-slow" /> ACTIVE
                          </span>
                        </div>
                        <div className="font-bold text-white text-base mb-0.5">{r?.name || b.riderNb}</div>
                        <div className="text-slate-500 text-xs mono mb-4">{b.riderNb}</div>
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2 text-slate-400">
                            <Clock size={13} className="text-blue-400 flex-shrink-0" />
                            {formatTime(s?.start||'')} – {formatTime(s?.end||'')}
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            <MapPin size={13} className="text-emerald-400 flex-shrink-0" />
                            {s?.notes || '—'}
                          </div>
                          <div className="flex items-center gap-2 text-slate-400">
                            <Timer size={13} className="text-violet-400 flex-shrink-0" />
                            {s?.hours}h shift
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {/* ── SHIFTS ── */}
        {page === 'shifts' && (
          <div className="animate-fade-in">
            <div className="section-header">
              <div>
                <h1 className="page-title">Shift Management</h1>
                <p className="text-slate-400 text-sm mt-1">All changes sync to Google Sheets instantly</p>
              </div>
              <button className="btn-primary" onClick={() => { setForm({ date: todayStr, capacity: 5, start: '09:00', end: '14:00', notes: '' }); setModal('addShift') }}>
                <Plus size={16} /> Create Shift
              </button>
            </div>
            <div className="glass-card border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['ID','Date','Time','Hrs','Cap','Booked','Status','Notes','Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {shifts.map((s, i) => {
                      const pct = s.capacity > 0 ? Math.round(s.booked/s.capacity*100) : 0
                      return (
                        <tr key={s.id} className="border-b border-white/4 hover:bg-white/2 transition-colors group">
                          <td className="px-4 py-3.5"><span className="text-xs mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">{s.id}</span></td>
                          <td className="px-4 py-3.5 font-medium text-white whitespace-nowrap">{formatDate(s.date)}</td>
                          <td className="px-4 py-3.5 mono text-sm text-slate-300 whitespace-nowrap">{formatTime(s.start)}–{formatTime(s.end)}</td>
                          <td className="px-4 py-3.5 mono text-slate-400">{s.hours}h</td>
                          <td className="px-4 py-3.5 mono text-slate-400">{s.capacity}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="mono font-semibold text-white text-xs">{s.booked}</span>
                              <div className="w-12 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width:`${Math.min(pct,100)}%`, background: pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981' }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><span className={s.status==='FULL'?'badge-red':'badge-green'}>{s.status}</span></td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[120px] truncate">{s.notes}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="btn-ghost p-2 rounded-lg" onClick={() => { setEditTarget(s); setForm({ capacity:s.capacity, notes:s.notes, start:s.start, end:s.end }); setModal('editShift') }} title="Edit"><Edit size={13} /></button>
                              <button className="btn-ghost p-2 rounded-lg" onClick={() => duplicateShift(s)} title="Duplicate"><Copy size={13} /></button>
                              <button className="btn-danger p-2 rounded-lg" onClick={() => deleteShift(s.id)} title="Delete"><Trash2 size={13} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── BOOKINGS ── */}
        {page === 'bookings' && (
          <div className="animate-fade-in">
            <div className="section-header">
              <div>
                <h1 className="page-title">Booking Management</h1>
                <p className="text-slate-400 text-sm mt-1">Live from Google Sheets · {bookings.length} total bookings</p>
              </div>
              <button className="btn-ghost" onClick={exportCSV}><Download size={15} /> Export CSV</button>
            </div>
            <div className="flex gap-3 mb-5 flex-wrap">
              <div className="relative flex-1 min-w-[200px]">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input className="input-field pl-9 py-2.5" placeholder="Search by name or NB..." value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select className="input-field w-40 py-2.5" value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}>
                <option value="">All Status</option><option>Confirmed</option><option>Cancelled</option>
              </select>
            </div>
            <div className="glass-card border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Booking','Rider','NB','Shift','Date','Hrs','Status','Reason'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBookings.map(b => {
                      const r = riders.find(x => x.nb === b.riderNb)
                      const s = shifts.find(x => x.id === b.shiftId)
                      return (
                        <tr key={b.id} className="border-b border-white/4 hover:bg-white/2 transition-colors">
                          <td className="px-4 py-3.5"><span className="text-xs mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">{b.id}</span></td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <Avatar name={r?.name || '?'} size="sm" />
                              <span className="font-medium text-white whitespace-nowrap">{r?.name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><span className="text-xs mono text-slate-500 bg-white/5 px-2 py-0.5 rounded-md">{b.riderNb}</span></td>
                          <td className="px-4 py-3.5"><span className="text-xs mono text-slate-500">{b.shiftId}</span></td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs whitespace-nowrap">{s?.date ? formatDate(s.date) : '—'} {s?.start ? formatTime(s.start) : ''}</td>
                          <td className="px-4 py-3.5 mono text-xs text-slate-400">{s?.hours||'—'}h</td>
                          <td className="px-4 py-3.5"><span className={b.status==='Confirmed'?'badge-blue':'badge-red'}>{b.status}</span></td>
                          <td className="px-4 py-3.5 text-slate-500 text-xs max-w-[140px] truncate">{b.cancelReason || '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── RIDERS ── */}
        {page === 'users' && (
          <div className="animate-fade-in">
            <div className="section-header">
              <div>
                <h1 className="page-title">Rider Management</h1>
                <p className="text-slate-400 text-sm mt-1">You assign NB numbers · synced with Google Sheets</p>
              </div>
              <button className="btn-primary" onClick={() => { setForm({}); setModal('addRider') }}><Plus size={16} /> Add Rider</button>
            </div>
            <div className="relative mb-5">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input className="input-field pl-9" placeholder="Search by name or NB number..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <div className="glass-card border border-white/10 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                      {['Rider','NB','Contact','Weekly Hrs','Cancels','Status','Actions'].map(h => (
                        <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRiders.map(r => {
                      const pct = Math.min(r.weeklyHours / 56 * 100, 100)
                      return (
                        <tr key={r.nb} className="border-b border-white/4 hover:bg-white/2 transition-colors group">
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-3">
                              <Avatar name={r.name} size="md" />
                              <div>
                                <div className="font-semibold text-white">{r.name}</div>
                                <div className="text-xs text-slate-500">{r.email}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><span className="text-xs mono text-slate-400 bg-white/5 px-2 py-0.5 rounded-md">{r.nb}</span></td>
                          <td className="px-4 py-3.5 text-slate-400 text-xs">{r.phone}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className={`mono text-xs font-bold ${r.weeklyHours>=56?'text-rose-400':r.weeklyHours>=45?'text-amber-400':'text-white'}`}>{r.weeklyHours}h</span>
                              <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width:`${pct}%`, background: r.weeklyHours>=56?'#f43f5e':r.weeklyHours>=45?'#f59e0b':'#3b82f6' }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5"><span className={r.cancellations>=5?'badge-red':r.cancellations>=3?'badge-amber':'badge-gray'}>{r.cancellations}/5</span></td>
                          <td className="px-4 py-3.5"><span className={r.active?'badge-green':'badge-red'}>{r.active?'Active':'Inactive'}</span></td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button className="btn-ghost p-2 rounded-lg" onClick={() => { setEditTarget(r); setForm({ name:r.name, phone:r.phone, email:r.email }); setModal('editRider') }}><Edit size={13} /></button>
                              <button className={`p-2 rounded-lg text-xs ${r.active?'btn-danger':'btn-success'}`} onClick={() => toggleRider(r.nb, !r.active)}>
                                {r.active ? <UserX size={13} /> : <UserCheck size={13} />}
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── HOURS ── */}
        {page === 'hours' && (() => {
          // Build per-rider hours breakdown from confirmed bookings
          const riderHoursMap: Record<string, {
            nb: string; name: string; confirmedHours: number; totalBookings: number
            cancelledCount: number; shifts: typeof bookings
          }> = {}

          bookings.forEach(b => {
            if (!riderHoursMap[b.riderNb]) {
              const r = riders.find(x => x.nb === b.riderNb)
              riderHoursMap[b.riderNb] = {
                nb: b.riderNb,
                name: b.riderName || r?.name || b.riderNb,
                confirmedHours: 0,
                totalBookings: 0,
                cancelledCount: 0,
                shifts: [],
              }
            }
            riderHoursMap[b.riderNb].totalBookings++
            riderHoursMap[b.riderNb].shifts.push(b)
            if (b.status === 'Confirmed') {
              riderHoursMap[b.riderNb].confirmedHours += (b.hours || 0)
            } else if (b.status === 'Cancelled') {
              riderHoursMap[b.riderNb].cancelledCount++
            }
          })

          const riderHoursList = Object.values(riderHoursMap)
            .sort((a, b) => b.confirmedHours - a.confirmedHours)

          const totalHoursAllRiders = riderHoursList.reduce((a, r) => a + r.confirmedHours, 0)
          const activeRidersWithHours = riderHoursList.filter(r => r.confirmedHours > 0).length

          return (
            <div className="animate-fade-in">
              <h1 className="page-title">Hours Booked Per Rider</h1>
              <p className="page-sub">Calculated from confirmed bookings in Google Sheets · 56h/week limit</p>

              {/* Summary KPIs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="glass-card border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold mono text-blue-400">{totalHoursAllRiders.toFixed(1)}h</div>
                  <div className="text-xs text-slate-500 mt-1">Total Hours Booked</div>
                </div>
                <div className="glass-card border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold mono text-emerald-400">{activeRidersWithHours}</div>
                  <div className="text-xs text-slate-500 mt-1">Riders With Hours</div>
                </div>
                <div className="glass-card border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold mono text-amber-400">
                    {activeRidersWithHours > 0 ? (totalHoursAllRiders / activeRidersWithHours).toFixed(1) : '0'}h
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Avg Hours/Rider</div>
                </div>
                <div className="glass-card border border-white/10 p-4 text-center">
                  <div className="text-2xl font-bold mono text-rose-400">
                    {riderHoursList.filter(r => r.confirmedHours >= 50).length}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Near/At Limit</div>
                </div>
              </div>

              {/* Alert */}
              {riderHoursList.filter(r => r.confirmedHours >= 45).length > 0 && (
                <div className="flex items-center gap-2.5 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-sm mb-5">
                  <AlertTriangle size={16} className="flex-shrink-0" />
                  <span>
                    <strong>{riderHoursList.filter(r=>r.confirmedHours>=45).length}</strong> rider{riderHoursList.filter(r=>r.confirmedHours>=45).length>1?'s':''} approaching or at the 56h weekly limit. The booking system automatically blocks bookings at the limit.
                  </span>
                </div>
              )}

              {/* Per-rider table */}
              <div className="glass-card border border-white/10 overflow-hidden mb-6">
                <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between">
                  <h3 className="font-semibold text-white text-sm">Hours Breakdown by Rider</h3>
                  <span className="text-xs text-slate-500">{riderHoursList.length} riders</span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.02)' }}>
                        {['Rank','Rider','NB','Hours Booked','Progress','Total Shifts','Cancels','Status'].map(h => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {riderHoursList.length === 0 && (
                        <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-600">No booking data yet</td></tr>
                      )}
                      {riderHoursList.map((r, i) => {
                        const pct = Math.min(r.confirmedHours / 56 * 100, 100)
                        const barColor = r.confirmedHours >= 56 ? '#f43f5e' : r.confirmedHours >= 45 ? '#f59e0b' : r.confirmedHours >= 30 ? '#3b82f6' : '#10b981'
                        const riderInfo = riders.find(x => x.nb === r.nb)
                        return (
                          <tr key={r.nb} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-3.5">
                              <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mono ${i===0?'bg-amber-500/20 text-amber-400':i===1?'bg-slate-500/20 text-slate-400':i===2?'bg-orange-700/20 text-orange-600':'bg-white/5 text-slate-600'}`}>
                                {i+1}
                              </span>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex items-center gap-2.5">
                                <Avatar name={r.name} size="sm" />
                                <span className="font-semibold text-white whitespace-nowrap">{r.name}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5"><span className="text-xs mono text-slate-400 bg-white/5 px-2 py-1 rounded">{r.nb}</span></td>
                            <td className="px-4 py-3.5">
                              <span className="font-bold mono text-lg" style={{ color: barColor }}>{r.confirmedHours.toFixed(1)}</span>
                              <span className="text-slate-500 text-xs mono ml-1">/ 56h</span>
                            </td>
                            <td className="px-4 py-3.5 min-w-[140px]">
                              <div className="flex items-center gap-2">
                                <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                                  <div className="h-full rounded-full transition-all duration-700" style={{ width:`${pct}%`, background: barColor }} />
                                </div>
                                <span className="text-xs mono text-slate-500 w-8 text-right">{Math.round(pct)}%</span>
                              </div>
                              <div className="text-xs text-slate-600 mt-1">{Math.max(0, 56 - r.confirmedHours).toFixed(1)}h remaining</div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="font-semibold text-white mono">{r.totalBookings - r.cancelledCount}</span>
                              <span className="text-slate-600 text-xs"> shifts</span>
                            </td>
                            <td className="px-4 py-3.5">
                              <span className={`badge-${r.cancelledCount >= 5 ? 'red' : r.cancelledCount >= 3 ? 'amber' : 'gray'}`}>{r.cancelledCount}/5</span>
                            </td>
                            <td className="px-4 py-3.5">
                              {r.confirmedHours >= 56 ? <span className="badge-red flex items-center gap-1 whitespace-nowrap"><AlertTriangle size={11}/> Limit</span>
                              : r.confirmedHours >= 45 ? <span className="badge-amber flex items-center gap-1 whitespace-nowrap"><AlertTriangle size={11}/> Near</span>
                              : <span className="badge-green">OK</span>}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Weekly hours cards from riders sheet */}
              <div className="glass-card border border-white/10 p-5">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-semibold text-white">Weekly Hours (from Riders sheet)</h3>
                  <span className="text-xs text-slate-500">Synced with Google Sheets</span>
                </div>
                <div className="space-y-3">
                  {[...riders].sort((a,b)=>b.weeklyHours-a.weeklyHours).map(r => {
                    const pct = Math.min(r.weeklyHours/56*100,100)
                    const color = r.weeklyHours>=56?'#f43f5e':r.weeklyHours>=45?'#f59e0b':'#3b82f6'
                    return (
                      <div key={r.nb} className="flex items-center gap-4 flex-wrap">
                        <Avatar name={r.name} size="sm" />
                        <div className="flex-1 min-w-[180px]">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-sm font-medium text-white">{r.name} <span className="text-xs mono text-slate-500 ml-1">{r.nb}</span></span>
                            <span className="mono text-xs font-bold" style={{color}}>{r.weeklyHours}<span className="text-slate-600">/56h</span></span>
                          </div>
                          <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                            <div className="h-full rounded-full" style={{width:`${pct}%`, background: color}} />
                          </div>
                        </div>
                        {r.weeklyHours >= 56 && <span className="badge-red text-xs">Limit</span>}
                        {r.weeklyHours >= 45 && r.weeklyHours < 56 && <span className="badge-amber text-xs">Near</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )
        })()}

      </Layout>

      {/* ── MODALS ── */}
      {modal === 'addRider' && (
        <Modal title="Add Rider" subtitle="You assign the NB number — rider uses it to log in" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">NB Number (you choose)</label><input className="input-field" placeholder="e.g. NB1006" value={form.nb||''} onChange={e => setForm({...form, nb:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label><input className="input-field" placeholder="First Last" value={form.name||''} onChange={e => setForm({...form, name:e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</label><input className="input-field" placeholder="+44 7700..." value={form.phone||''} onChange={e => setForm({...form, phone:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label><input className="input-field" placeholder="rider@email.com" value={form.email||''} onChange={e => setForm({...form, email:e.target.value})} /></div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={addRider}><Plus size={15} /> Add Rider</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'editRider' && editTarget && (
        <Modal title="Edit Rider" subtitle={`${editTarget.nb} · ${editTarget.name}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Full Name</label><input className="input-field" value={form.name||''} onChange={e => setForm({...form, name:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Phone</label><input className="input-field" value={form.phone||''} onChange={e => setForm({...form, phone:e.target.value})} /></div>
            </div>
            <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email</label><input className="input-field" value={form.email||''} onChange={e => setForm({...form, email:e.target.value})} /></div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEditRider}><CheckCircle size={15} /> Save Changes</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'addShift' && (
        <Modal title="Create Shift" subtitle="Saved to Google Sheets — visible to riders immediately" onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Date</label><input type="date" className="input-field" value={form.date||''} onChange={e => setForm({...form, date:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Rider Slots</label><input type="number" className="input-field" min="1" max="50" value={form.capacity||5} onChange={e => setForm({...form, capacity:e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Start Time</label><input type="time" className="input-field" value={form.start||'09:00'} onChange={e => setForm({...form, start:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">End Time</label><input type="time" className="input-field" value={form.end||'14:00'} onChange={e => setForm({...form, end:e.target.value})} /></div>
            </div>
            <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes / Route</label><input className="input-field" placeholder="e.g. City centre route" value={form.notes||''} onChange={e => setForm({...form, notes:e.target.value})} /></div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={addShift}><Plus size={15} /> Create Shift</button>
            </div>
          </div>
        </Modal>
      )}

      {modal === 'editShift' && editTarget && (
        <Modal title="Edit Shift" subtitle={`${editTarget.id} · ${editTarget.date}`} onClose={() => setModal(null)}>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Start Time</label><input type="time" className="input-field" value={form.start||''} onChange={e => setForm({...form, start:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">End Time</label><input type="time" className="input-field" value={form.end||''} onChange={e => setForm({...form, end:e.target.value})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Capacity</label><input type="number" className="input-field" min="1" value={form.capacity||''} onChange={e => setForm({...form, capacity:e.target.value})} /></div>
              <div><label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Notes</label><input className="input-field" value={form.notes||''} onChange={e => setForm({...form, notes:e.target.value})} /></div>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn-primary" onClick={saveEditShift}><CheckCircle size={15} /> Save Changes</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
