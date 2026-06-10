import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import {
  LayoutDashboard, Radio, Calendar, Receipt, Users, BarChart3,
  LogOut, Plus, Edit, Trash2, Copy, Download, RefreshCw, Shield,
  TrendingUp, Activity, Clock, AlertTriangle, CheckCircle, XCircle,
  Search, ChevronRight, Timer, MapPin, UserCheck, UserX,
} from 'lucide-react'
import { Spinner, Toast, Modal, ProgressRing, EmptyState, Avatar, KpiCard, Skeleton } from '../components/ui'
import Layout from '../components/Layout'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt12(t: string) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ampm = h >= 12 ? 'PM' : 'AM'
  return `${h % 12 || 12}:${String(m).padStart(2,'0')} ${ampm}`
}
function fmtDate(d: string) {
  const dt = new Date(d + 'T00:00:00')
  return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}

type Rider   = { nb: string; name: string; phone: string; email: string; active: boolean; weeklyHours: number; cancellations: number }
type Shift   = { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; booked: number; status: string; notes: string }
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

export default function AdminPortal() {
  const [authed,        setAuthed]        = useState(false)
  const [email,         setEmail]         = useState('')
  const [password,      setPassword]      = useState('')
  const [loginErr,      setLoginErr]      = useState('')
  const [loginLoading,  setLoginLoading]  = useState(false)
  const [page,          setPage]          = useState<'dashboard'|'live'|'shifts'|'bookings'|'users'|'hours'>('dashboard')
  const [riders,        setRiders]        = useState<Rider[]>([])
  const [shifts,        setShifts]        = useState<Shift[]>([])
  const [bookings,      setBookings]      = useState<Booking[]>([])
  const [loading,       setLoading]       = useState(false)
  const [syncing,       setSyncing]       = useState(false)
  const [lastSync,      setLastSync]      = useState<Date|null>(null)
  const [toast,         setToast]         = useState<{type:any;message:string}|null>(null)
  const [modal,         setModal]         = useState<null|'addRider'|'addShift'|'editShift'|'editRider'>(null)
  const [editTarget,    setEditTarget]    = useState<any>(null)
  const [form,          setForm]          = useState<any>({})
  const [search,        setSearch]        = useState('')
  const [bookingFilter, setBookingFilter] = useState('')
  const [bookingPage,   setBookingPage]   = useState(1)
  const [riderPage,     setRiderPage]     = useState(1)
  const [shiftPage,     setShiftPage]     = useState(1)
  const [syncError,     setSyncError]     = useState<string|null>(null)
  const PAGE_SIZE = 50

  const showToast = (type: any, message: string) => setToast({ type, message })

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [rRes, sRes, bRes] = await Promise.all([fetch('/api/riders'), fetch('/api/shifts'), fetch('/api/bookings')])
      if (rRes.ok) setRiders(await rRes.json())
      if (sRes.ok) setShifts(await sRes.json())
      if (bRes.ok) setBookings(await bRes.json())
      setLastSync(new Date())
      setSyncError(null)
      setSyncError(null)
    } catch (e: any) {
      console.error('[loadAll]', e.message)
      setSyncError('Sync failed at ' + new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}))
      if (!silent) showToast('error', 'Failed to sync with Google Sheets. Retrying shortly.')
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
      const res = await fetch('/api/auth/admin-login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ email, password }) })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error || 'Invalid credentials'); return }
      setAuthed(true)
    } catch { setLoginErr('Network error') }
    finally { setLoginLoading(false) }
  }

  async function logout() { await fetch('/api/auth/logout', { method:'POST' }); setAuthed(false) }

  const api = async (method: string, url: string, body?: any) => {
    const res  = await fetch(url, { method, headers:{'Content-Type':'application/json'}, body: body ? JSON.stringify(body) : undefined })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  }

  async function addRider()     { try { await api('POST', '/api/riders', form); showToast('success',`Rider ${form.nb} added`); setModal(null); setForm({}); loadAll(true) } catch(e:any){ showToast('error',e.message) } }
  async function saveEditRider(){ try { await api('PATCH','/api/riders',{ nb:editTarget.nb,...form }); showToast('success','Rider updated'); setModal(null); setForm({}); loadAll(true) } catch(e:any){ showToast('error',e.message) } }
  async function toggleRider(nb:string,active:boolean){ try { await api('PATCH','/api/riders',{ nb,active }); showToast('success',`Rider ${active?'activated':'disabled'}`); loadAll(true) } catch(e:any){ showToast('error',e.message) } }
  async function addShift()     { if(!form.date||!form.start||!form.end){showToast('error','Date, start and end required');return} try { const d=await api('POST','/api/shifts',form); showToast('success',`Shift ${d.id} created`); setModal(null); setForm({}); loadAll(true) } catch(e:any){ showToast('error',e.message) } }
  async function saveEditShift(){ try { await api('PATCH','/api/shifts',{ id:editTarget.id,...form }); showToast('success','Shift updated'); setModal(null); setForm({}); loadAll(true) } catch(e:any){ showToast('error',e.message) } }
  async function deleteShift(id:string){ if(!confirm('Delete this shift?')) return; try { await api('DELETE','/api/shifts',{ id }); showToast('success','Shift deleted'); loadAll(true) } catch(e:any){ showToast('error',e.message) } }
  async function duplicateShift(s:Shift){ try { const d=await api('POST','/api/shifts',{ date:s.date,start:s.start,end:s.end,capacity:s.capacity,notes:s.notes }); showToast('success',`Duplicated as ${d.id}`); loadAll(true) } catch(e:any){ showToast('error',e.message) } }

  function exportCSV() {
    const rows = [['Booking_ID','MB_No','Rider_Name','Shift_ID','Shift_Date','Day','Start_Time','End_Time','Hours','Status','Cancel_Reason','Created_At','Updated_At']]
    filteredBookings.forEach(b => rows.push([b.id,b.riderNb,b.riderName||'',b.shiftId,b.shiftDate||'',b.day||'',b.startTime||'',b.endTime||'',String(b.hours||''),b.status,b.cancelReason||'',b.createdAt||'',b.updatedAt||'']))
    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n')
    const a = document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`fleetops_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    showToast('success','CSV exported')
  }

  // Live shift detection
  const now     = new Date()
  // Use local date, not UTC (avoids wrong-day bug for non-UTC timezones)
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const nowMins  = now.getHours()*60 + now.getMinutes()
  const toMins   = (t:string) => { const [h,m]=t.split(':').map(Number); return h*60+m }
  // Extended live shift status
  function getShiftStatus(s: Shift) {
    if (s.date !== todayStr) return 'scheduled'
    const startM = toMins(s.start)
    const endM   = toMins(s.end)
    if (nowMins < startM - 30) return 'scheduled'
    if (nowMins >= startM - 30 && nowMins < startM) return 'starting_soon'
    if (nowMins >= startM && nowMins <= endM - 15) return 'active'
    if (nowMins > endM - 15 && nowMins <= endM) return 'ending_soon'
    if (nowMins > endM) return 'completed'
    return 'scheduled'
  }
  function getMinsRemaining(s: Shift) {
    return Math.max(0, toMins(s.end) - nowMins)
  }

  const liveBookings = bookings.filter(b => {
    if (b.status !== 'Confirmed') return false
    const s = shifts.find(x => x.id === b.shiftId)
    if (!s || s.date !== todayStr) return false
    const st = getShiftStatus(s)
    return st === 'active' || st === 'starting_soon' || st === 'ending_soon'
  })

  const filteredRiders   = riders.filter(r => !search || r.name.toLowerCase().includes(search.toLowerCase()) || r.nb.toLowerCase().includes(search.toLowerCase()))
  const filteredBookings = bookings.filter(b => {
    const r = riders.find(x => x.nb === b.riderNb)
    const matchSearch = !search || (r?.name||'').toLowerCase().includes(search.toLowerCase()) || (b.riderNb||'').toLowerCase().includes(search.toLowerCase()) || (b.riderName||'').toLowerCase().includes(search.toLowerCase()) || (b.shiftId||'').toLowerCase().includes(search.toLowerCase()) || (b.shiftDate||'').includes(search)
    return matchSearch && (!bookingFilter || b.status === bookingFilter)
  })

  const totalBooked    = shifts.reduce((a,s) => a+s.booked, 0)
  const totalCapacity  = shifts.reduce((a,s) => a+s.capacity, 0)
  const utilizationPct = totalCapacity ? Math.round(totalBooked/totalCapacity*100) : 0

  // ── LOGIN ──────────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <Head><title>FleetOps — Admin</title></Head>
        <div className="app-bg" aria-hidden><div className="app-grid" /><div className="app-scanline" /></div>
        {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
        <div className="login-wrap">
          <div className="login-card anim-up" style={{ borderColor:'rgba(124,58,237,0.2)', boxShadow:'0 32px 80px rgba(0,0,0,0.5), 0 0 60px rgba(109,40,217,0.08)' }}>
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:28 }}>
              <div className="logo-icon" style={{ width:42, height:42, borderRadius:13, background:'linear-gradient(135deg,#7c3aed,#4c1d95)' }}>
                <Shield size={20} color="#fff" />
              </div>
              <div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:17, color:'#f1f5ff' }}>FleetOps</div>
                <div style={{ fontSize:11, color:'#a78bfa', fontWeight:600, letterSpacing:'0.12em', textTransform:'uppercase' }}>Admin Console</div>
              </div>
            </div>
            <h1 style={{ fontSize:26, fontWeight:800, color:'#f1f5ff', letterSpacing:'-0.5px', marginBottom:4 }}>Admin Login</h1>
            <p style={{ fontSize:13.5, color:'rgba(100,116,139,0.85)', marginBottom:28 }}>Restricted to authorised administrators only</p>
            {loginErr && <div className="alert alert-danger" style={{ marginBottom:20 }}><XCircle size={15} style={{ flexShrink:0 }} /> {loginErr}</div>}
            <div style={{ marginBottom:16 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Email</label>
              <input type="email" className="input-field" placeholder="admin@yourcompany.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <div style={{ marginBottom:24 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Password</label>
              <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <button onClick={login} disabled={loginLoading} style={{ width:'100%', justifyContent:'center', padding:'13px', borderRadius:14, fontSize:15, display:'flex', alignItems:'center', gap:8, fontWeight:700, color:'#fff', border:'none', cursor:'pointer', background:'linear-gradient(135deg,#7c3aed,#4c1d95)', boxShadow:'0 0 24px rgba(124,58,237,0.45)' }}>
              {loginLoading ? <><Spinner size={16} /> Signing in...</> : <><Shield size={16} /> Sign In to Admin</>}
            </button>
            <div style={{ marginTop:20, padding:'12px 14px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, fontSize:12, color:'rgba(100,116,139,0.55)', display:'flex', gap:8, alignItems:'flex-start' }}>
              <Shield size={13} style={{ flexShrink:0, marginTop:1 }} /> Riders access <code style={{ color:'rgba(148,163,184,0.6)', margin:'0 3px' }}>/rider</code> — they cannot reach this page.
            </div>
          </div>
        </div>
      </>
    )
  }

  const navItems = [
    { id:'dashboard', label:'Dashboard',  icon:LayoutDashboard },
    { id:'live',      label:'Live Now',    icon:Radio, badge: liveBookings.length > 0 ? liveBookings.length : undefined },
    { id:'shifts',    label:'Shifts',      icon:Calendar },
    { id:'bookings',  label:'Bookings',    icon:Receipt },
    { id:'users',     label:'Riders',      icon:Users },
    { id:'hours',     label:'Hours',       icon:BarChart3 },
  ]

  const sidebarBottom = (
    <>
      <button onClick={() => loadAll(true)} disabled={syncing} className="nav-item" style={{ color:'rgba(148,163,184,0.6)', marginBottom:2 }}>
        <RefreshCw size={15} style={{ animation: syncing ? 'spin 0.8s linear infinite' : 'none' }} /><span>{syncing ? 'Syncing…' : 'Refresh Data'}</span>
      </button>
      <button className="nav-item" style={{ color:'rgba(251,113,133,0.8)' }} onClick={logout}><LogOut size={15} /><span>Logout</span></button>
    </>
  )

  const topbarRight = (
    <div style={{ display:'flex', alignItems:'center', gap:12 }}>
      {syncError && <span style={{ fontSize:11, color:'#fb7185', background:'rgba(244,63,94,0.1)', border:'1px solid rgba(244,63,94,0.25)', padding:'3px 8px', borderRadius:6 }}>⚠ Sync error</span>}
      {!syncError && lastSync && <span style={{ fontSize:11, color:'rgba(100,116,139,0.5)' }}>Synced {lastSync.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>}
      <span className="badge badge-violet" style={{ display:'flex', alignItems:'center', gap:5 }}><Shield size={10} /> Admin</span>
      <button className="btn-ghost btn-sm" onClick={exportCSV}><Download size={13} /> Export</button>
    </div>
  )

  // ── SHARED LABEL ──────────────────────────────────────────
  const TH = ({ children }: any) => (
    <th style={{ textAlign:'left', padding:'11px 16px', fontSize:10.5, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.7)', background:'rgba(255,255,255,0.025)', borderBottom:'1px solid rgba(255,255,255,0.055)', whiteSpace:'nowrap' }}>{children}</th>
  )
  const TD = ({ children, style = {} }: any) => (
    <td style={{ padding:'12px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)', verticalAlign:'middle', ...style }}>{children}</td>
  )

  return (
    <>
      <Head><title>FleetOps — Admin Console</title></Head>
      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}

      <Layout navItems={navItems} activePage={page} onNav={p => setPage(p as any)}
        topbarRight={topbarRight} sidebarBottom={sidebarBottom}
        portalLabel="Admin" portalColor="#a78bfa">

        {/* ══ DASHBOARD ════════════════════════════════════ */}
        {page === 'dashboard' && (
          <div className="anim-fade">
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 className="page-title">Operations Dashboard</h1>
                <p className="page-sub">{now.toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
              </div>
              {liveBookings.length > 0 && (
                <button onClick={() => setPage('live')} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 16px', borderRadius:20, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.25)', color:'#34d399', fontSize:13, fontWeight:600, cursor:'pointer', transition:'all 0.15s' }}>
                  <span className="live-pulse" style={{ width:7, height:7 }}><span className="live-pulse-dot" style={{ width:7, height:7 }} /><span className="live-pulse-ring" /></span>
                  {liveBookings.length} rider{liveBookings.length>1?'s':''} on shift now <ChevronRight size={14} />
                </button>
              )}
            </div>

            {loading ? (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
                {[1,2,3,4,5,6].map(i => <Skeleton key={i} style={{ height:110 }} />)}
              </div>
            ) : (
              <div className="stagger-children" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))', gap:12, marginBottom:24 }}>
                <KpiCard label="Total Riders"  value={riders.length}              sub={`${riders.filter(r=>r.active).length} active`} color="blue"   icon={Users}       />
                <KpiCard label="Live Now"       value={liveBookings.length}        sub="on shift"    color="green"  icon={Activity}    />
                <KpiCard label="Total Shifts"   value={shifts.length}              sub={`${shifts.filter(s=>s.status==='FULL').length} full`} color="violet" icon={Calendar}    />
                <KpiCard label="Utilization"    value={`${utilizationPct}%`}       sub={`${totalBooked}/${totalCapacity} slots`} color="cyan"   icon={TrendingUp}  />
                <KpiCard label="Cancellations"  value={bookings.filter(b=>b.status==='Cancelled').length} sub="total" color="amber" icon={XCircle} />
                <KpiCard label="Open Slots"     value={shifts.reduce((a,s)=>a+(s.capacity-s.booked),0)} sub="available" color="rose" icon={Timer} />
              </div>
            )}

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
              {/* Recent bookings */}
              <div className="glass-card" style={{ padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                  <span className="section-title">Recent Bookings</span>
                  <button onClick={() => setPage('bookings')} style={{ fontSize:12, color:'#60a5fa', background:'none', border:'none', cursor:'pointer' }}>View all →</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
                  {bookings.slice(-6).reverse().map((b, i) => {
                    const r = riders.find(x => x.nb === b.riderNb)
                    return (
                      <div key={b.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 0', borderBottom: i < 5 ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                        <Avatar name={r?.name || b.riderNb} size="sm" />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:500, color:'#e1e7f5', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.riderName || r?.name || b.riderNb}</div>
                          <div style={{ fontSize:11, color:'rgba(100,116,139,0.65)' }}>{b.shiftId} · {b.shiftDate || ''}</div>
                        </div>
                        <span className={`badge ${b.status==='Confirmed'?'badge-blue':'badge-red'}`}>{b.status}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Fill rates */}
              <div className="glass-card" style={{ padding:'20px' }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
                  <span className="section-title">Shift Fill Rates</span>
                  <button onClick={() => setPage('shifts')} style={{ fontSize:12, color:'#60a5fa', background:'none', border:'none', cursor:'pointer' }}>Manage →</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                  {shifts.slice(0,7).map(s => {
                    const pct = s.capacity > 0 ? Math.round(s.booked/s.capacity*100) : 0
                    const col = pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981'
                    return (
                      <div key={s.id}>
                        <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:5 }}>
                          <span style={{ color:'rgba(148,163,184,0.7)' }}>{s.id} · {fmt12(s.start)}–{fmt12(s.end)}</span>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, color:col }}>{pct}%</span>
                        </div>
                        <div className="progress-track" style={{ height:4 }}>
                          <div className="progress-fill" style={{ width:`${Math.min(pct,100)}%`, background:`linear-gradient(90deg,${col}90,${col})` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ LIVE NOW ══════════════════════════════════════ */}
        {page === 'live' && (
          <div className="anim-fade">
            <h1 className="page-title">Live Active Riders</h1>
            <p className="page-sub">Riders currently on shift — refreshes every 20 seconds</p>
            {liveBookings.length === 0
              ? <EmptyState icon={Radio} title="No active shifts" description="No riders are currently on shift." />
              : (
                <>
                  <div className="alert alert-success" style={{ marginBottom:20 }}>
                    <span className="live-pulse"><span className="live-pulse-dot" /><span className="live-pulse-ring" /></span>
                    <strong>{liveBookings.length}</strong> rider{liveBookings.length>1?'s':''} on shift as of {now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:14 }}>
                    {liveBookings.map(b => {
                      const r = riders.find(x => x.nb === b.riderNb)
                      const s = shifts.find(x => x.id === b.shiftId)
                      return (
                        <div key={b.id} className="glass-card" style={{ padding:'20px', border:'1px solid rgba(16,185,129,0.2)', background:'rgba(5,150,105,0.06)' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:14 }}>
                            <Avatar name={r?.name || '?'} size="lg" />
                            <span className="badge badge-green" style={{ display:'flex', alignItems:'center', gap:6, alignSelf:'flex-start' }}>
                              <span className="live-pulse"><span className="live-pulse-dot" style={{ width:6, height:6 }} /><span className="live-pulse-ring" style={{ inset:-2 }} /></span> ACTIVE
                            </span>
                          </div>
                          <div style={{ fontWeight:700, fontSize:15, color:'#f1f5ff', marginBottom:2 }}>{r?.name || b.riderNb}</div>
                          <span className="rider-tag" style={{ marginBottom:14, display:'inline-block' }}>{b.riderNb}</span>
                          <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13, color:'rgba(148,163,184,0.75)', marginTop:10 }}>
                            <span style={{ display:'flex', alignItems:'center', gap:6 }}><Clock size={13} color="#60a5fa" /> {fmt12(s?.start||'')} – {fmt12(s?.end||'')}</span>
                            <span style={{ display:'flex', alignItems:'center', gap:6 }}><MapPin size={13} color="#6ee7b7" /> {s?.notes}</span>
                            <span style={{ display:'flex', alignItems:'center', gap:6 }}><Timer size={13} color="#c4b5fd" /> {s?.hours}h shift</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
          </div>
        )}

        {/* ══ SHIFTS ════════════════════════════════════════ */}
        {page === 'shifts' && (
          <div className="anim-fade">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 className="page-title">Shift Management</h1>
                <p className="page-sub">Changes sync instantly to Google Sheets</p>
              </div>
              <button className="btn-primary" onClick={() => { setForm({ date:todayStr, capacity:5, start:'09:00', end:'14:00', notes:'' }); setModal('addShift') }}>
                <Plus size={15} /> Create Shift
              </button>
            </div>
            <div className="glass-card" style={{ overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><TH>ID</TH><TH>Date</TH><TH>Day</TH><TH>Start</TH><TH>End</TH><TH>Hrs</TH><TH>Cap</TH><TH>Booked</TH><TH>Status</TH><TH>Notes</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {shifts.filter(s => !search || s.id.toLowerCase().includes(search.toLowerCase()) || (s.notes||'').toLowerCase().includes(search.toLowerCase()) || s.date.includes(search)).slice((shiftPage-1)*PAGE_SIZE, shiftPage*PAGE_SIZE).map(s => {
                      const pct = s.capacity > 0 ? Math.round(s.booked/s.capacity*100) : 0
                      return (
                        <tr key={s.id} style={{ transition:'background 0.12s' }} onMouseEnter={e => (e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e => (e.currentTarget.style.background='')}>
                          <TD><span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', padding:'2px 8px', borderRadius:6, color:'rgba(148,163,184,0.75)' }}>{s.id}</span></TD>
                          <TD style={{ fontWeight:600, color:'#e1e7f5', whiteSpace:'nowrap' }}>{fmtDate(s.date)}</TD>
                          <TD style={{ color:'rgba(148,163,184,0.65)', fontSize:12 }}>{s.day}</TD>
                          <TD style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#6ee7b7', fontWeight:600 }}>{fmt12(s.start)}</TD>
                          <TD style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#6ee7b7', fontWeight:600 }}>{fmt12(s.end)}</TD>
                          <TD style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:'#93c5fd' }}>{s.hours}h</TD>
                          <TD style={{ fontSize:13 }}>{s.capacity}</TD>
                          <TD>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:13, color:'#f1f5ff' }}>{s.booked}</span>
                              <div className="progress-track" style={{ width:44, height:4, margin:0 }}>
                                <div className="progress-fill" style={{ width:`${Math.min(pct,100)}%`, background: pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981' }} />
                              </div>
                            </div>
                          </TD>
                          <TD><span className={`badge ${s.status==='FULL'?'badge-red':'badge-green'}`}>{s.status}</span></TD>
                          <TD style={{ color:'rgba(100,116,139,0.65)', fontSize:12, maxWidth:110, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{s.notes}</TD>
                          <TD>
                            <div style={{ display:'flex', gap:5 }}>
                              <button className="btn-ghost btn-xs" onClick={() => { setEditTarget(s); setForm({ capacity:s.capacity, notes:s.notes, start:s.start, end:s.end }); setModal('editShift') }} title="Edit"><Edit size={12} /></button>
                              <button className="btn-ghost btn-xs" onClick={() => duplicateShift(s)} title="Duplicate"><Copy size={12} /></button>
                              <button className="btn-danger btn-xs" onClick={() => deleteShift(s.id)} title="Delete"><Trash2 size={12} /></button>
                            </div>
                          </TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ BOOKINGS ══════════════════════════════════════ */}
        {page === 'bookings' && (
          <div className="anim-fade">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 className="page-title">Booking Management</h1>
                <p className="page-sub">Live from Google Sheets · {bookings.length} total · <span style={{ color:'#6ee7b7' }}>{bookings.filter(b=>b.status==='Confirmed').length} confirmed</span> · <span style={{ color:'#fb7185' }}>{bookings.filter(b=>b.status==='Cancelled').length} cancelled</span></p>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn-ghost btn-sm" onClick={async () => { const r=await fetch('/api/setup-headers'); const d=await r.json(); showToast(r.ok?'success':'error', d.message||d.error) }}>Fix Headers</button>
                <button className="btn-ghost" onClick={exportCSV}><Download size={14} /> Export CSV</button>
              </div>
            </div>

            {/* Summary row */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
              {[
                { l:'Total', v:bookings.length, c:'#93c5fd' },
                { l:'Confirmed', v:bookings.filter(b=>b.status==='Confirmed').length, c:'#6ee7b7' },
                { l:'Cancelled', v:bookings.filter(b=>b.status==='Cancelled').length, c:'#fb7185' },
                { l:'Confirmed Hours', v:`${bookings.filter(b=>b.status==='Confirmed').reduce((a,b)=>a+(Number(b.hours)||0),0).toFixed(1)}h`, c:'#60a5fa' },
              ].map(s => (
                <div key={s.l} className="glass-card" style={{ padding:'12px', textAlign:'center' }}>
                  <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:22, fontWeight:700, color:s.c }}>{s.v}</div>
                  <div style={{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.08em', color:'rgba(100,116,139,0.65)', marginTop:4 }}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Filters */}
            <div style={{ display:'flex', gap:10, marginBottom:16, flexWrap:'wrap' }}>
              <div style={{ position:'relative', flex:1, minWidth:200 }}>
                <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(100,116,139,0.6)' }} />
                <input className="input-field" style={{ paddingLeft:36 }} placeholder="Search by rider, MB No, shift or date…" value={search} onChange={e => { setSearch(e.target.value); setBookingPage(1); setRiderPage(1); setShiftPage(1) }} />
              </div>
              <select className="input-field" style={{ width:160 }} value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}>
                <option value="">All Status</option>
                <option value="Confirmed">Confirmed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            <div className="glass-card" style={{ overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr>
                    <TH>Booking ID</TH><TH>Rider</TH><TH>Shift ID</TH>
                    <TH>Date</TH><TH>Start</TH><TH>End</TH><TH>Hours</TH>
                    <TH>Status</TH><TH>Cancel Reason</TH><TH>Timestamp</TH>
                  </tr></thead>
                  <tbody>
                    {filteredBookings.length === 0 && <tr><td colSpan={10} style={{ padding:'48px', textAlign:'center', color:'rgba(100,116,139,0.5)', fontSize:14 }}>No bookings found</td></tr>}
                    {filteredBookings.slice((bookingPage-1)*PAGE_SIZE, bookingPage*PAGE_SIZE).map(b => {
                      const r = riders.find(x => x.nb === b.riderNb)
                      return (
                        <tr key={b.id} onMouseEnter={e => (e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e => (e.currentTarget.style.background='')} style={{ transition:'background 0.12s' }}>
                          <TD><span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.07)', padding:'2px 7px', borderRadius:6, color:'rgba(148,163,184,0.7)' }}>{b.id}</span></TD>
                          <TD>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <Avatar name={r?.name || b.riderNb} size="sm" />
                              <div>
                                <div style={{ fontWeight:600, fontSize:13, color:'#e1e7f5' }}>{b.riderName || r?.name || b.riderNb}</div>
                                <span className="rider-tag" style={{ fontSize:10 }}>{b.riderNb}</span>
                              </div>
                            </div>
                          </TD>
                          <TD><span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'rgba(148,163,184,0.65)' }}>{b.shiftId||'—'}</span></TD>
                          <TD style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:'#e1e7f5', whiteSpace:'nowrap' }}>{b.shiftDate||'—'}</TD><TD style={{ fontSize:12, color:'rgba(148,163,184,0.7)' }}>{b.day||'—'}</TD>
                          
                          
                          <TD><span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color:'#93c5fd' }}>{b.hours > 0 ? `${b.hours}h` : '—'}</span></TD>
                          <TD><span className={`badge ${b.status==='Confirmed'?'badge-green':b.status==='Cancelled'?'badge-red':'badge-gray'}`}>{b.status}</span></TD>
                          <TD style={{ fontSize:12, color:'rgba(100,116,139,0.65)', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{b.cancelReason||'—'}</TD>
                          <TD style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:'#6ee7b7', whiteSpace:'nowrap' }}>{b.startTime||'—'} – {b.endTime||'—'}</TD><TD style={{ fontSize:11, color:'rgba(100,116,139,0.5)', whiteSpace:'nowrap' }}>{b.createdAt||'—'}</TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {/* Pagination */}
            {filteredBookings.length > PAGE_SIZE && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize:12, color:'rgba(100,116,139,0.6)' }}>
                  Showing {Math.min((bookingPage-1)*PAGE_SIZE+1, filteredBookings.length)}–{Math.min(bookingPage*PAGE_SIZE, filteredBookings.length)} of {filteredBookings.length}
                </span>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-ghost btn-xs" disabled={bookingPage===1} onClick={() => setBookingPage(p=>p-1)}>← Prev</button>
                  <span style={{ fontSize:12, color:'rgba(148,163,184,0.7)', padding:'4px 8px' }}>Page {bookingPage} / {Math.ceil(filteredBookings.length/PAGE_SIZE)}</span>
                  <button className="btn-ghost btn-xs" disabled={bookingPage*PAGE_SIZE>=filteredBookings.length} onClick={() => setBookingPage(p=>p+1)}>Next →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ RIDERS ════════════════════════════════════════ */}
        {page === 'users' && (
          <div className="anim-fade">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
              <div>
                <h1 className="page-title">Rider Management</h1>
                <p className="page-sub">You assign MB Numbers · synced with Google Sheets</p>
              </div>
              <button className="btn-primary" onClick={() => { setForm({}); setModal('addRider') }}><Plus size={15} /> Add Rider</button>
            </div>
            <div style={{ position:'relative', marginBottom:16 }}>
              <Search size={14} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'rgba(100,116,139,0.6)' }} />
              <input className="input-field" style={{ paddingLeft:36 }} placeholder="Search by name or MB No…" value={search} onChange={e => { setSearch(e.target.value); setBookingPage(1); setRiderPage(1); setShiftPage(1) }} />
            </div>
            <div className="glass-card" style={{ overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead><tr><TH>Rider</TH><TH>MB No</TH><TH>Phone</TH><TH>Email</TH><TH>Weekly Hours</TH><TH>Cancels</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {filteredRiders.slice((riderPage-1)*PAGE_SIZE, riderPage*PAGE_SIZE).map(r => {
                      const pct = Math.min(r.weeklyHours / 56 * 100, 100)
                      const col = r.weeklyHours >= 56 ? '#f43f5e' : r.weeklyHours >= 45 ? '#f59e0b' : '#3b82f6'
                      return (
                        <tr key={r.nb} onMouseEnter={e => (e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e => (e.currentTarget.style.background='')} style={{ transition:'background 0.12s' }}>
                          <TD>
                            <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                              <Avatar name={r.name} size="md" />
                              <div>
                                <div style={{ fontWeight:600, fontSize:13.5, color:'#f1f5ff' }}>{r.name}</div>
                                <div style={{ fontSize:11, color:'rgba(100,116,139,0.6)' }}>{r.email}</div>
                              </div>
                            </div>
                          </TD>
                          <TD><span className="rider-tag">MB: {r.nb}</span></TD>
                          <TD style={{ fontSize:12, color:'rgba(148,163,184,0.7)' }}>{r.phone}</TD>
                          <TD style={{ fontSize:12, color:'rgba(148,163,184,0.7)' }}>{r.email}</TD>
                          <TD>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:700, color:col, minWidth:36 }}>{r.weeklyHours}h</span>
                              <div className="progress-track" style={{ width:72, height:5, margin:0 }}>
                                <div className="progress-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${col}90,${col})` }} />
                              </div>
                            </div>
                          </TD>
                          <TD><span className={`badge ${r.cancellations>=5?'badge-red':r.cancellations>=3?'badge-amber':'badge-gray'}`}>{r.cancellations}/5</span></TD>
                          <TD><span className={`badge ${r.active?'badge-green':'badge-red'}`}>{r.active?'Active':'Inactive'}</span></TD>
                          <TD>
                            <div style={{ display:'flex', gap:5 }}>
                              <button className="btn-ghost btn-xs" onClick={() => { setEditTarget(r); setForm({ name:r.name, phone:r.phone, email:r.email }); setModal('editRider') }} title="Edit"><Edit size={12} /></button>
                              <button className={`btn-xs ${r.active?'btn-danger':'btn-success'}`} onClick={() => toggleRider(r.nb,!r.active)}>
                                {r.active ? <UserX size={12} /> : <UserCheck size={12} />}
                              </button>
                            </div>
                          </TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {filteredRiders.length > PAGE_SIZE && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 20px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ fontSize:12, color:'rgba(100,116,139,0.6)' }}>
                  Showing {Math.min((riderPage-1)*PAGE_SIZE+1, filteredRiders.length)}–{Math.min(riderPage*PAGE_SIZE, filteredRiders.length)} of {filteredRiders.length}
                </span>
                <div style={{ display:'flex', gap:8 }}>
                  <button className="btn-ghost btn-xs" disabled={riderPage===1} onClick={() => setRiderPage(p=>p-1)}>← Prev</button>
                  <span style={{ fontSize:12, color:'rgba(148,163,184,0.7)', padding:'4px 8px' }}>Page {riderPage} / {Math.ceil(filteredRiders.length/PAGE_SIZE)}</span>
                  <button className="btn-ghost btn-xs" disabled={riderPage*PAGE_SIZE>=filteredRiders.length} onClick={() => setRiderPage(p=>p+1)}>Next →</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ HOURS ═════════════════════════════════════════ */}
        {page === 'hours' && (() => {
          // Build per-rider hours from confirmed bookings
          const map: Record<string,{ nb:string; name:string; confirmedHours:number; totalBookings:number; cancelledCount:number }> = {}
          bookings.forEach(b => {
            if (!map[b.riderNb]) {
              const r = riders.find(x => x.nb === b.riderNb)
              map[b.riderNb] = { nb:b.riderNb, name:b.riderName||r?.name||b.riderNb, confirmedHours:0, totalBookings:0, cancelledCount:0 }
            }
            map[b.riderNb].totalBookings++
            if (b.status === 'Confirmed') map[b.riderNb].confirmedHours += (b.hours||0)
            else if (b.status === 'Cancelled') map[b.riderNb].cancelledCount++
          })
          const list  = Object.values(map).sort((a,b) => b.confirmedHours - a.confirmedHours)
          const total = list.reduce((a,r) => a + r.confirmedHours, 0)
          const avg   = list.length ? total / list.length : 0

          return (
            <div className="anim-fade">
              <h1 className="page-title">Hours Booked Per Rider</h1>
              <p className="page-sub">Calculated from confirmed bookings · 56h/week limit · 8h/day limit</p>

              <div className="stagger-children" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:22 }}>
                <KpiCard label="Total Hours"    value={`${total.toFixed(1)}h`}  color="blue"  icon={Timer}      />
                <KpiCard label="Riders Tracked" value={list.length}             color="green" icon={Users}      />
                <KpiCard label="Avg Hours"       value={`${avg.toFixed(1)}h`}  color="violet" icon={TrendingUp} />
                <KpiCard label="Near/At Limit"  value={list.filter(r=>r.confirmedHours>=45).length} color="amber" icon={AlertTriangle} />
              </div>

              {list.filter(r=>r.confirmedHours>=45).length > 0 && (
                <div className="alert alert-warning" style={{ marginBottom:18 }}>
                  <AlertTriangle size={15} style={{ flexShrink:0 }} />
                  <span><strong>{list.filter(r=>r.confirmedHours>=45).length}</strong> rider{list.filter(r=>r.confirmedHours>=45).length>1?'s':''} approaching or at the 56h limit. The system automatically blocks further bookings at the limit.</span>
                </div>
              )}

              {/* Ranked table */}
              <div className="glass-card" style={{ overflow:'hidden', marginBottom:16 }}>
                <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.05)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span className="section-title">Hours Leaderboard</span>
                  <span style={{ fontSize:11, color:'rgba(100,116,139,0.5)' }}>{list.length} riders</span>
                </div>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ width:'100%', borderCollapse:'collapse' }}>
                    <thead><tr><TH>#</TH><TH>Rider</TH><TH>Hours Booked</TH><TH>Weekly Progress</TH><TH>Shifts</TH><TH>Cancels</TH><TH>Status</TH></tr></thead>
                    <tbody>
                      {list.length === 0 && <tr><td colSpan={7} style={{ padding:'48px', textAlign:'center', color:'rgba(100,116,139,0.5)' }}>No booking data yet</td></tr>}
                      {list.map((r, i) => {
                        const pct = Math.min(r.confirmedHours / 56 * 100, 100)
                        const col = r.confirmedHours >= 56 ? '#f43f5e' : r.confirmedHours >= 45 ? '#f59e0b' : r.confirmedHours >= 30 ? '#3b82f6' : '#10b981'
                        const rankCols = ['rgba(251,191,36,0.25)','rgba(148,163,184,0.2)','rgba(180,83,9,0.2)']
                        const rankTxt  = ['#fcd34d','#94a3b8','#d97706']
                        return (
                          <tr key={r.nb} onMouseEnter={e => (e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e => (e.currentTarget.style.background='')} style={{ transition:'background 0.12s' }}>
                            <TD>
                              <div style={{ width:28, height:28, borderRadius:8, background: i < 3 ? rankCols[i] : 'rgba(255,255,255,0.04)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color: i < 3 ? rankTxt[i] : 'rgba(100,116,139,0.5)' }}>{i+1}</div>
                            </TD>
                            <TD>
                              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                                <Avatar name={r.name} size="sm" />
                                <div>
                                  <div style={{ fontWeight:600, fontSize:13.5, color:'#f1f5ff' }}>{r.name}</div>
                                  <span className="rider-tag" style={{ fontSize:10 }}>{r.nb}</span>
                                </div>
                              </div>
                            </TD>
                            <TD>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:22, fontWeight:700, color:col }}>{r.confirmedHours.toFixed(1)}</span>
                              <span style={{ fontSize:12, color:'rgba(100,116,139,0.5)', marginLeft:3 }}>/ 56h</span>
                            </TD>
                            <TD style={{ minWidth:180 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div className="progress-track" style={{ flex:1, height:6, margin:0 }}>
                                  <div className="progress-fill" style={{ width:`${pct}%`, background:`linear-gradient(90deg,${col}80,${col})`, boxShadow:`0 0 8px ${col}50` }} />
                                </div>
                                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:'rgba(100,116,139,0.6)', minWidth:30 }}>{Math.round(pct)}%</span>
                              </div>
                              <div style={{ fontSize:11, color:'rgba(100,116,139,0.45)', marginTop:4 }}>{Math.max(0, 56 - r.confirmedHours).toFixed(1)}h remaining</div>
                            </TD>
                            <TD style={{ textAlign:'center' }}>
                              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontWeight:700, fontSize:14, color:'#e1e7f5' }}>{r.totalBookings - r.cancelledCount}</span>
                              <span style={{ fontSize:11, color:'rgba(100,116,139,0.5)', marginLeft:4 }}>shifts</span>
                            </TD>
                            <TD><span className={`badge ${r.cancelledCount>=5?'badge-red':r.cancelledCount>=3?'badge-amber':'badge-gray'}`}>{r.cancelledCount}/5</span></TD>
                            <TD>
                              {r.confirmedHours >= 56 ? <span className="badge badge-red" style={{ display:'flex', alignItems:'center', gap:4 }}><AlertTriangle size={10} /> Limit</span>
                              : r.confirmedHours >= 45 ? <span className="badge badge-amber" style={{ display:'flex', alignItems:'center', gap:4 }}><AlertTriangle size={10} /> Near</span>
                              : <span className="badge badge-green">OK</span>}
                            </TD>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )
        })()}

      </Layout>

      {/* ══ MODALS ════════════════════════════════════════════ */}
      {modal === 'addRider' && (
        <Modal title="Add Rider" subtitle="You assign the MB No — rider uses it to log in" onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>MB No</label><input className="input-field" placeholder="e.g. MB001" value={form.nb||''} onChange={e => setForm({...form,nb:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Full Name</label><input className="input-field" placeholder="First Last" value={form.name||''} onChange={e => setForm({...form,name:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Phone</label><input className="input-field" placeholder="+44 7700…" value={form.phone||''} onChange={e => setForm({...form,phone:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Email</label><input className="input-field" placeholder="rider@email.com" value={form.email||''} onChange={e => setForm({...form,email:e.target.value})} /></div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={addRider}><Plus size={14} /> Add Rider</button>
          </div>
        </Modal>
      )}

      {modal === 'editRider' && editTarget && (
        <Modal title="Edit Rider" subtitle={`${editTarget.nb} · ${editTarget.name}`} onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Full Name</label><input className="input-field" value={form.name||''} onChange={e => setForm({...form,name:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Phone</label><input className="input-field" value={form.phone||''} onChange={e => setForm({...form,phone:e.target.value})} /></div>
          </div>
          <div style={{ marginBottom:20 }}><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Email</label><input className="input-field" value={form.email||''} onChange={e => setForm({...form,email:e.target.value})} /></div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEditRider}><CheckCircle size={14} /> Save Changes</button>
          </div>
        </Modal>
      )}

      {modal === 'addShift' && (
        <Modal title="Create Shift" subtitle="Saved to Google Sheets — visible to riders immediately" onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Date</label><input type="date" className="input-field" value={form.date||''} onChange={e => setForm({...form,date:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Rider Slots</label><input type="number" className="input-field" min="1" max="50" value={form.capacity||5} onChange={e => setForm({...form,capacity:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Start Time</label><input type="time" className="input-field" value={form.start||'09:00'} onChange={e => setForm({...form,start:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>End Time</label><input type="time" className="input-field" value={form.end||'14:00'} onChange={e => setForm({...form,end:e.target.value})} /></div>
          </div>
          <div style={{ marginBottom:20 }}><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Notes / Route</label><input className="input-field" placeholder="e.g. City centre route" value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} /></div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={addShift}><Plus size={14} /> Create Shift</button>
          </div>
        </Modal>
      )}

      {modal === 'editShift' && editTarget && (
        <Modal title="Edit Shift" subtitle={`${editTarget.id} · ${editTarget.date}`} onClose={() => setModal(null)}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Start Time</label><input type="time" className="input-field" value={form.start||''} onChange={e => setForm({...form,start:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>End Time</label><input type="time" className="input-field" value={form.end||''} onChange={e => setForm({...form,end:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Capacity</label><input type="number" className="input-field" min="1" value={form.capacity||''} onChange={e => setForm({...form,capacity:e.target.value})} /></div>
            <div><label style={{ display:'block', fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em', color:'rgba(100,116,139,0.8)', marginBottom:7 }}>Notes</label><input className="input-field" value={form.notes||''} onChange={e => setForm({...form,notes:e.target.value})} /></div>
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button className="btn-ghost" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={saveEditShift}><CheckCircle size={14} /> Save Changes</button>
          </div>
        </Modal>
      )}
    </>
  )
}
