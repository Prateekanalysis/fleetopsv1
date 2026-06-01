// pages/admin.tsx
import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

type Rider = { nb: string; name: string; phone: string; email: string; active: boolean; weeklyHours: number; cancellations: number }
type Shift = { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; booked: number; status: string; notes: string }
type Booking = { id: string; riderNb: string; shiftId: string; status: string; cancelReason: string; createdAt: string }

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
  const [msg, setMsg] = useState<{type:string;text:string}|null>(null)
  const [modal, setModal] = useState<null|'addRider'|'addShift'|'editShift'|'editRider'>(null)
  const [editTarget, setEditTarget] = useState<any>(null)
  const [form, setForm] = useState<any>({})
  const [riderSearch, setRiderSearch] = useState('')
  const [bookingFilter, setBookingFilter] = useState('')

  const toast = (type: string, text: string) => { setMsg({ type, text }); setTimeout(() => setMsg(null), 3500) }

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const [rRes, sRes, bRes] = await Promise.all([
        fetch('/api/riders'), fetch('/api/shifts'), fetch('/api/bookings')
      ])
      if (rRes.ok) setRiders(await rRes.json())
      if (sRes.ok) setShifts(await sRes.json())
      if (bRes.ok) setBookings(await bRes.json())
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { if (authed) loadAll() }, [authed, loadAll])

  async function login() {
    setLoginLoading(true); setLoginErr('')
    try {
      const res = await fetch('/api/auth/admin-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error || 'Invalid credentials'); return }
      setAuthed(true)
    } catch { setLoginErr('Network error') }
    finally { setLoginLoading(false) }
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    setAuthed(false); setRiders([]); setShifts([]); setBookings([])
  }

  async function addRider() {
    const res = await fetch('/api/riders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    if (!res.ok) { toast('error', data.error); return }
    toast('success', 'Rider added to Google Sheet'); setModal(null); setForm({}); loadAll()
  }

  async function toggleRider(nb: string, active: boolean) {
    const res = await fetch('/api/riders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nb, active })
    })
    if (!res.ok) { toast('error', 'Failed to update rider'); return }
    toast('success', `Rider ${active ? 'activated' : 'deactivated'}`)
    loadAll()
  }

  async function saveEditRider() {
    const res = await fetch('/api/riders', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nb: editTarget.nb, ...form })
    })
    if (!res.ok) { toast('error', 'Failed to update'); return }
    toast('success', 'Rider updated'); setModal(null); setForm({}); loadAll()
  }

  async function addShift() {
    if (!form.date || !form.start || !form.end) { toast('error', 'Date, start and end required'); return }
    const res = await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    if (!res.ok) { toast('error', data.error); return }
    toast('success', `Shift created: ${data.id}`); setModal(null); setForm({}); loadAll()
  }

  async function saveEditShift() {
    const res = await fetch('/api/shifts', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: editTarget.id, ...form })
    })
    if (!res.ok) { toast('error', 'Failed to update'); return }
    toast('success', 'Shift updated'); setModal(null); setForm({}); loadAll()
  }

  async function deleteShift(id: string) {
    if (!confirm('Delete this shift? This cannot be undone.')) return
    const res = await fetch('/api/shifts', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    })
    if (!res.ok) { toast('error', 'Failed to delete'); return }
    toast('success', 'Shift deleted'); loadAll()
  }

  async function duplicateShift(s: Shift) {
    const res = await fetch('/api/shifts', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: s.date, start: s.start, end: s.end, capacity: s.capacity, notes: s.notes })
    })
    const data = await res.json()
    if (!res.ok) { toast('error', data.error); return }
    toast('success', `Shift duplicated: ${data.id}`); loadAll()
  }

  function exportCSV() {
    const rows = [['Booking ID','Rider NB','Shift ID','Status','Cancel Reason','Created']]
    bookings.forEach(b => {
      const r = riders.find(x => x.nb === b.riderNb)
      rows.push([b.id, `${b.riderNb} (${r?.name||'?'})`, b.shiftId, b.status, b.cancelReason||'', b.createdAt])
    })
    const csv = rows.map(r => r.map(x => `"${x}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }))
    a.download = 'fleetops_bookings.csv'; a.click()
    toast('success', 'CSV exported')
  }

  // Live: bookings that are confirmed + shift is currently happening
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]
  const nowMins = now.getHours() * 60 + now.getMinutes()
  function toMins(t: string) { const [h,m] = t.split(':').map(Number); return h*60+m }

  const liveBookings = bookings.filter(b => {
    if (b.status !== 'Confirmed') return false
    const s = shifts.find(x => x.id === b.shiftId)
    if (!s || s.date !== todayStr) return false
    return nowMins >= toMins(s.start) && nowMins <= toMins(s.end)
  })

  const filteredRiders = riders.filter(r => !riderSearch || r.name.toLowerCase().includes(riderSearch.toLowerCase()) || r.nb.toLowerCase().includes(riderSearch.toLowerCase()))
  const filteredBookings = bookings.filter(b => !bookingFilter || b.status === bookingFilter)

  if (!authed) {
    return (
      <>
        <Head><title>FleetOps – Admin Login</title></Head>
        <div className="login-wrap">
          <div className="login-card">
            <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--danger)', letterSpacing:'0.1em', marginBottom:8 }}>FLEETOPS / ADMIN CONSOLE</div>
            <h1 style={{ fontSize:24, fontWeight:600, marginBottom:4 }}>Admin Login</h1>
            <p style={{ color:'var(--muted)', marginBottom:28 }}>This portal is restricted to authorised admins only</p>
            {loginErr && <div className="alert alert-danger"><i className="ti ti-alert-circle" /> {loginErr}</div>}
            <div className="form-group">
              <label className="form-label">Email</label>
              <input type="email" className="form-input" placeholder="admin@yourcompany.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input type="password" className="form-input" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:8 }} onClick={login} disabled={loginLoading}>
              {loginLoading ? <span className="spinner" /> : <><i className="ti ti-lock-open" /> Login to Admin</>}
            </button>
            <div style={{ marginTop:16, padding:12, background:'var(--bg3)', borderRadius:8, fontSize:12, color:'var(--muted)' }}>
              <i className="ti ti-shield-lock" style={{ marginRight:6 }} />
              Riders cannot access this portal. The login URL is /admin — keep it private.
            </div>
          </div>
        </div>
      </>
    )
  }

  const stats = {
    total: riders.length, active: riders.filter(r=>r.active).length,
    totalShifts: shifts.length, fullShifts: shifts.filter(s=>s.status==='FULL').length,
    openSlots: shifts.reduce((a,s)=>a+(s.capacity-s.booked),0),
    cancelled: bookings.filter(b=>b.status==='Cancelled').length
  }

  return (
    <>
      <Head><title>FleetOps – Admin</title></Head>
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>
        <div className="topbar">
          <div className="topbar-logo">FLEET<span>OPS</span> <span style={{ color:'var(--danger)', fontSize:11 }}>ADMIN</span></div>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={loadAll}><i className="ti ti-refresh" /> Sync Sheets</button>
          <button className="btn btn-ghost btn-sm" onClick={logout}><i className="ti ti-logout" /> Logout</button>
        </div>

        {msg && <div className="alert" style={{ position:'fixed', bottom:20, right:20, zIndex:300, maxWidth:340, margin:0, background:'var(--bg3)', border:'1px solid var(--border2)' }}>
          <i className={`ti ti-${msg.type==='success'?'check':'alert-circle'}`} style={{ color: msg.type==='success'?'var(--success)':'var(--danger)' }} />{msg.text}
        </div>}

        <div className="layout" style={{ minHeight:'calc(100vh - 56px)' }}>
          <div className="sidebar">
            <div style={{ padding:'4px 8px 16px' }}>
              <div style={{ fontSize:10, color:'var(--danger)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:600 }}>Admin Console</div>
            </div>
            <div className="sidebar-label">Overview</div>
            <button className={`nav-item ${page==='dashboard'?'active':''}`} onClick={() => setPage('dashboard')}><i className="ti ti-layout-dashboard" /><span className="nav-text">Dashboard</span></button>
            <button className={`nav-item ${page==='live'?'active':''}`} onClick={() => setPage('live')}>
              <i className="ti ti-radio" /><span className="nav-text">Live Now</span>
              <span className="live-dot" style={{ marginLeft:'auto' }} />
            </button>
            <div className="sidebar-label" style={{ marginTop:16 }}>Management</div>
            <button className={`nav-item ${page==='shifts'?'active':''}`} onClick={() => setPage('shifts')}><i className="ti ti-calendar" /><span className="nav-text">Shifts</span></button>
            <button className={`nav-item ${page==='bookings'?'active':''}`} onClick={() => setPage('bookings')}><i className="ti ti-receipt" /><span className="nav-text">Bookings</span></button>
            <button className={`nav-item ${page==='users'?'active':''}`} onClick={() => setPage('users')}><i className="ti ti-users" /><span className="nav-text">Riders</span></button>
            <button className={`nav-item ${page==='hours'?'active':''}`} onClick={() => setPage('hours')}><i className="ti ti-chart-bar" /><span className="nav-text">Hours</span></button>
          </div>

          <div className="content">
            {loading && page==='dashboard' && <div style={{ textAlign:'center', padding:40 }}><span className="spinner" /></div>}

            {/* Dashboard */}
            {page === 'dashboard' && !loading && <>
              <div className="page-title">Dashboard</div>
              <p className="page-sub">{new Date().toLocaleDateString('en-GB',{ weekday:'long', year:'numeric', month:'long', day:'numeric' })}</p>
              <div className="stat-grid">
                <div className="stat-card blue"><div className="stat-label">Total Riders</div><div className="stat-value">{stats.total}</div></div>
                <div className="stat-card green"><div className="stat-label">Active Riders</div><div className="stat-value">{stats.active}</div></div>
                <div className="stat-card amber"><div className="stat-label">Total Shifts</div><div className="stat-value">{stats.totalShifts}</div></div>
                <div className="stat-card blue"><div className="stat-label">Full Shifts</div><div className="stat-value">{stats.fullShifts}</div></div>
                <div className="stat-card green"><div className="stat-label">Open Slots</div><div className="stat-value">{stats.openSlots}</div></div>
                <div className="stat-card red"><div className="stat-label">Cancellations</div><div className="stat-value">{stats.cancelled}</div></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                <div className="card">
                  <div className="section-title" style={{ marginBottom:14 }}>Recent Bookings</div>
                  {bookings.slice(-5).reverse().map(b => {
                    const r = riders.find(x => x.nb === b.riderNb)
                    const s = shifts.find(x => x.id === b.shiftId)
                    return <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                      <div>
                        <div style={{ fontWeight:500, fontSize:13 }}>{r?.name||b.riderNb}</div>
                        <div style={{ fontSize:11, color:'var(--muted)' }}>{b.shiftId} · {s?.date||''}</div>
                      </div>
                      <span className={`badge ${b.status==='Confirmed'?'badge-blue':'badge-red'}`}>{b.status}</span>
                    </div>
                  })}
                </div>
                <div className="card">
                  <div className="section-title" style={{ marginBottom:14 }}>Shift Fill Rates</div>
                  {shifts.slice(0,6).map(s => {
                    const pct = s.capacity > 0 ? Math.round(s.booked/s.capacity*100) : 0
                    return <div key={s.id} style={{ marginBottom:12 }}>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:12, marginBottom:4 }}>
                        <span style={{ color:'var(--muted)' }}>{s.id} · {s.start}–{s.end}</span>
                        <span style={{ fontWeight:600 }}>{pct}%</span>
                      </div>
                      <div className="cap-bar"><div className={`cap-fill ${pct>=100?'high':pct>=70?'mid':'low'}`} style={{ width:`${Math.min(pct,100)}%` }} /></div>
                    </div>
                  })}
                </div>
              </div>
            </>}

            {/* Live Now */}
            {page === 'live' && <>
              <div className="page-title">Live Active Shifts</div>
              <p className="page-sub">Riders currently on shift right now — {new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</p>
              {liveBookings.length === 0 && <div className="empty"><i className="ti ti-radio-off" /><p>No active shifts right now</p></div>}
              <div className="shift-grid">
                {liveBookings.map(b => {
                  const r = riders.find(x => x.nb === b.riderNb)
                  const s = shifts.find(x => x.id === b.shiftId)
                  return <div key={b.id} className="card">
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:12 }}>
                      <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(79,124,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, color:'var(--accent)', fontSize:14 }}>
                        {(r?.name||'?').split(' ').map((x:string)=>x[0]).join('').slice(0,2)}
                      </div>
                      <span className="badge badge-green"><span className="live-dot" style={{ width:6,height:6 }} /> ACTIVE</span>
                    </div>
                    <div style={{ fontWeight:600 }}>{r?.name||b.riderNb}</div>
                    <span className="rider-tag">{b.riderNb}</span>
                    <div style={{ marginTop:10, fontSize:13, color:'var(--muted)' }}><i className="ti ti-clock" /> {s?.start} – {s?.end}</div>
                    <div style={{ fontSize:12, color:'var(--muted)', marginTop:4 }}><i className="ti ti-map-pin" /> {s?.notes}</div>
                  </div>
                })}
              </div>
            </>}

            {/* Shifts */}
            {page === 'shifts' && <>
              <div className="section-header">
                <div><div className="page-title">Shift Management</div><p className="page-sub" style={{ margin:0 }}>All changes sync to Google Sheets</p></div>
                <button className="btn btn-primary" onClick={() => { setForm({ date: todayStr, capacity: 5, notes: '' }); setModal('addShift') }}><i className="ti ti-plus" /> Create Shift</button>
              </div>
              <div className="card" style={{ padding:0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ID</th><th>Date</th><th>Time</th><th>Hrs</th><th>Cap</th><th>Booked</th><th>Status</th><th>Notes</th><th>Actions</th></tr></thead>
                    <tbody>
                      {shifts.map(s => {
                        const pct = s.capacity > 0 ? Math.round(s.booked/s.capacity*100) : 0
                        return <tr key={s.id}>
                          <td><span className="rider-tag">{s.id}</span></td>
                          <td>{s.date}</td>
                          <td style={{ fontFamily:'var(--mono)', fontSize:12 }}>{s.start}–{s.end}</td>
                          <td>{s.hours}h</td>
                          <td>{s.capacity}</td>
                          <td>
                            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                              <span>{s.booked}</span>
                              <div className="cap-bar" style={{ width:40, margin:0 }}><div className={`cap-fill ${pct>=100?'high':pct>=70?'mid':'low'}`} style={{ width:`${Math.min(pct,100)}%` }} /></div>
                            </div>
                          </td>
                          <td><span className={`badge ${s.status==='FULL'?'badge-red':'badge-green'}`}>{s.status}</span></td>
                          <td style={{ color:'var(--muted)', fontSize:12 }}>{s.notes}</td>
                          <td>
                            <div style={{ display:'flex', gap:6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setEditTarget(s); setForm({ capacity: s.capacity, notes: s.notes, start: s.start, end: s.end }); setModal('editShift') }}><i className="ti ti-edit" /></button>
                              <button className="btn btn-danger btn-sm" onClick={() => deleteShift(s.id)}><i className="ti ti-trash" /></button>
                              <button className="btn btn-ghost btn-sm" onClick={() => duplicateShift(s)}><i className="ti ti-copy" /></button>
                            </div>
                          </td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>}

            {/* Bookings */}
            {page === 'bookings' && <>
              <div className="section-header">
                <div><div className="page-title">Booking Management</div><p className="page-sub" style={{ margin:0 }}>All rider bookings from Google Sheets</p></div>
                <button className="btn btn-ghost" onClick={exportCSV}><i className="ti ti-download" /> Export CSV</button>
              </div>
              <div className="card" style={{ padding:'12px 16px', marginBottom:16, display:'flex', gap:10, flexWrap:'wrap' }}>
                <input className="form-input" style={{ width:200 }} placeholder="Filter by name or NB..." value={riderSearch} onChange={e => setRiderSearch(e.target.value)} />
                <select className="form-input" style={{ width:160 }} value={bookingFilter} onChange={e => setBookingFilter(e.target.value)}>
                  <option value="">All Status</option>
                  <option>Confirmed</option><option>Cancelled</option>
                </select>
              </div>
              <div className="card" style={{ padding:0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>ID</th><th>Rider</th><th>NB#</th><th>Shift</th><th>Date/Time</th><th>Status</th><th>Cancel Reason</th></tr></thead>
                    <tbody>
                      {filteredBookings.filter(b => {
                        const r = riders.find(x => x.nb === b.riderNb)
                        if (!riderSearch) return true
                        return (r?.name||'').toLowerCase().includes(riderSearch.toLowerCase()) || b.riderNb.toLowerCase().includes(riderSearch.toLowerCase())
                      }).map(b => {
                        const r = riders.find(x => x.nb === b.riderNb)
                        const s = shifts.find(x => x.id === b.shiftId)
                        return <tr key={b.id}>
                          <td><span className="rider-tag">{b.id}</span></td>
                          <td style={{ fontWeight:500 }}>{r?.name||'—'}</td>
                          <td><span className="rider-tag">{b.riderNb}</span></td>
                          <td><span className="rider-tag">{b.shiftId}</span></td>
                          <td style={{ fontSize:12, color:'var(--muted)' }}>{s?.date||''} {s?.start&&s?.end?`${s.start}–${s.end}`:''}</td>
                          <td><span className={`badge ${b.status==='Confirmed'?'badge-blue':'badge-red'}`}>{b.status}</span></td>
                          <td style={{ color:'var(--muted)', fontSize:12 }}>{b.cancelReason||'—'}</td>
                        </tr>
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>}

            {/* Users/Riders */}
            {page === 'users' && <>
              <div className="section-header">
                <div><div className="page-title">Rider Management</div><p className="page-sub" style={{ margin:0 }}>Riders sync from Google Sheets — you assign NB numbers</p></div>
                <button className="btn btn-primary" onClick={() => { setForm({}); setModal('addRider') }}><i className="ti ti-plus" /> Add Rider</button>
              </div>
              <div style={{ position:'relative', marginBottom:16 }}>
                <i className="ti ti-search" style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:'var(--muted)' }} />
                <input className="form-input" style={{ paddingLeft:36 }} placeholder="Search by name or NB number..." value={riderSearch} onChange={e => setRiderSearch(e.target.value)} />
              </div>
              <div className="card" style={{ padding:0 }}>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>NB#</th><th>Name</th><th>Phone</th><th>Email</th><th>Weekly Hours</th><th>Cancels</th><th>Status</th><th>Actions</th></tr></thead>
                    <tbody>
                      {filteredRiders.map(r => (
                        <tr key={r.nb}>
                          <td><span className="rider-tag">{r.nb}</span></td>
                          <td style={{ fontWeight:500 }}>{r.name}</td>
                          <td style={{ color:'var(--muted)', fontSize:13 }}>{r.phone}</td>
                          <td style={{ color:'var(--muted)', fontSize:13 }}>{r.email}</td>
                          <td>
                            <div style={{ fontSize:13 }}>{r.weeklyHours}h</div>
                            <div className="hours-bar" style={{ width:80 }}><div className="hours-fill" style={{ width:`${Math.min(r.weeklyHours/40*100,100)}%`, background: r.weeklyHours>40?'var(--danger)':'var(--accent)' }} /></div>
                          </td>
                          <td><span className={`badge ${r.cancellations>=5?'badge-red':r.cancellations>=3?'badge-amber':'badge-gray'}`}>{r.cancellations}/5</span></td>
                          <td><span className={`badge ${r.active?'badge-green':'badge-red'}`}>{r.active?'Active':'Inactive'}</span></td>
                          <td>
                            <div style={{ display:'flex', gap:6 }}>
                              <button className="btn btn-ghost btn-sm" onClick={() => { setEditTarget(r); setForm({ name: r.name, phone: r.phone, email: r.email }); setModal('editRider') }}><i className="ti ti-edit" /></button>
                              <button className={`btn btn-sm ${r.active?'btn-danger':'btn-success'}`} onClick={() => toggleRider(r.nb, !r.active)}>
                                {r.active ? <><i className="ti ti-lock" /> Disable</> : <><i className="ti ti-lock-open" /> Enable</>}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>}

            {/* Hours */}
            {page === 'hours' && <>
              <div className="page-title">Weekly Hours Tracking</div>
              <p className="page-sub">Auto-calculated from completed shifts. 40h/week recommended maximum.</p>
              <div className="alert alert-warning" style={{ marginBottom:16 }}>
                <i className="ti ti-alert-triangle" /> Riders over 40h are highlighted in red. Contact them to manage their schedule.
              </div>
              {[...riders].sort((a,b) => b.weeklyHours - a.weeklyHours).map(r => (
                <div key={r.nb} className="card" style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
                  <div style={{ width:40, height:40, borderRadius:'50%', background:'rgba(79,124,255,0.15)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:600, color:'var(--accent)', fontSize:14, flexShrink:0 }}>
                    {r.name.split(' ').map(x=>x[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex:1, minWidth:200 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                      <span><strong>{r.name}</strong> <span className="rider-tag">{r.nb}</span></span>
                      <span style={{ fontWeight:600, fontFamily:'var(--mono)', color: r.weeklyHours>40?'var(--danger)':'var(--text)' }}>{r.weeklyHours}h</span>
                    </div>
                    <div className="hours-bar">
                      <div className="hours-fill" style={{ width:`${Math.min(r.weeklyHours/40*100,100)}%`, background: r.weeklyHours>40?'var(--danger)':r.weeklyHours>30?'var(--warning)':'var(--accent)' }} />
                    </div>
                    <div style={{ fontSize:11, color:'var(--muted)', marginTop:4 }}>{r.weeklyHours}/40h · {r.active?'Active':'Inactive'} · {r.cancellations} cancels</div>
                  </div>
                  {r.weeklyHours > 40 && <span className="badge badge-red"><i className="ti ti-alert-triangle" /> Overworked</span>}
                </div>
              ))}
            </>}
          </div>
        </div>

        {/* Modals */}
        {modal === 'addRider' && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Add Rider</div>
              <div className="modal-sub">This rider will be saved to your Google Sheet</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">NB Number (you assign this)</label><input className="form-input" placeholder="e.g. NB1006" value={form.nb||''} onChange={e => setForm({...form, nb: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" placeholder="First Last" value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" placeholder="+44 7700..." value={form.phone||''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Email</label><input className="form-input" placeholder="rider@email.com" value={form.email||''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={addRider}><i className="ti ti-plus" /> Add to Sheet</button>
              </div>
            </div>
          </div>
        )}

        {modal === 'editRider' && editTarget && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Edit Rider</div>
              <div className="modal-sub"><span className="rider-tag">{editTarget.nb}</span></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Full Name</label><input className="form-input" value={form.name||''} onChange={e => setForm({...form, name: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone||''} onChange={e => setForm({...form, phone: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" value={form.email||''} onChange={e => setForm({...form, email: e.target.value})} /></div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEditRider}><i className="ti ti-check" /> Save Changes</button>
              </div>
            </div>
          </div>
        )}

        {modal === 'addShift' && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Create Shift</div>
              <div className="modal-sub">New shift will be saved to Google Sheets</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={form.date||''} onChange={e => setForm({...form, date: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Capacity (slots)</label><input type="number" className="form-input" min="1" max="50" value={form.capacity||5} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Start Time</label><input type="time" className="form-input" value={form.start||'09:00'} onChange={e => setForm({...form, start: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">End Time</label><input type="time" className="form-input" value={form.end||'14:00'} onChange={e => setForm({...form, end: e.target.value})} /></div>
              </div>
              <div className="form-group"><label className="form-label">Notes</label><input className="form-input" placeholder="e.g. City centre route" value={form.notes||''} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={addShift}><i className="ti ti-plus" /> Create Shift</button>
              </div>
            </div>
          </div>
        )}

        {modal === 'editShift' && editTarget && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Edit Shift</div>
              <div className="modal-sub"><span className="rider-tag">{editTarget.id}</span> · {editTarget.date}</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Start Time</label><input type="time" className="form-input" value={form.start||''} onChange={e => setForm({...form, start: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">End Time</label><input type="time" className="form-input" value={form.end||''} onChange={e => setForm({...form, end: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Capacity</label><input type="number" className="form-input" min="1" value={form.capacity||''} onChange={e => setForm({...form, capacity: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Notes</label><input className="form-input" value={form.notes||''} onChange={e => setForm({...form, notes: e.target.value})} /></div>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
                <button className="btn btn-primary" onClick={saveEditShift}><i className="ti ti-check" /> Save Changes</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
