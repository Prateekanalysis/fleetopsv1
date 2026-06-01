// pages/rider.tsx
import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/router'
import Head from 'next/head'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function getNext7Days() {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i); return d
  })
}

type Rider = { nb: string; name: string; email: string; phone: string }
type Shift = { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; booked: number; status: string; notes: string }
type Booking = { id: string; riderNb: string; shiftId: string; status: string; cancelReason: string; createdAt: string }

export default function RiderPortal() {
  const router = useRouter()
  const [rider, setRider] = useState<Rider | null>(null)
  const [page, setPage] = useState<'shifts'|'mybookings'|'upcoming'|'notifications'>('shifts')
  const [shifts, setShifts] = useState<Shift[]>([])
  const [bookings, setBookings] = useState<Booking[]>([])
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{type:string;text:string}|null>(null)
  const [modal, setModal] = useState<null|'cancel'>(null)
  const [cancelTarget, setCancelTarget] = useState<{bookingId:string;reason:string}|null>(null)

  // Login state
  const [nb, setNb] = useState('')
  const [contact, setContact] = useState('')
  const [loginErr, setLoginErr] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const toast = (type: string, text: string) => {
    setMsg({ type, text }); setTimeout(() => setMsg(null), 3500)
  }

  const loadData = useCallback(async () => {
    if (!rider) return
    setLoading(true)
    try {
      const [sRes, bRes] = await Promise.all([
        fetch('/api/shifts'), fetch('/api/bookings')
      ])
      if (sRes.ok) setShifts(await sRes.json())
      if (bRes.ok) setBookings(await bRes.json())
    } finally { setLoading(false) }
  }, [rider])

  useEffect(() => { if (rider) loadData() }, [rider, loadData])

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
      if (!res.ok) { toast('error', data.error); return }
      toast('success', `Shift booked! ID: ${data.bookingId}`)
      await loadData()
    } finally { setLoading(false) }
  }

  async function cancelBooking() {
    if (!cancelTarget?.reason) { toast('error', 'Please select a reason'); return }
    setLoading(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: cancelTarget.bookingId, reason: cancelTarget.reason })
      })
      const data = await res.json()
      if (!res.ok) { toast('error', data.error); return }
      toast('success', 'Booking cancelled')
      setModal(null); await loadData()
    } finally { setLoading(false) }
  }

  const myBookings = bookings.filter(b => b.riderNb === rider?.nb)
  const myConfirmed = myBookings.filter(b => b.status === 'Confirmed')
  const myCancelled = myBookings.filter(b => b.status === 'Cancelled')
  const dayShifts = shifts.filter(s => s.date === selectedDate)
  const bookedShiftIds = new Set(myConfirmed.map(b => b.shiftId))

  if (!rider) {
    return (
      <>
        <Head><title>FleetOps – Rider Login</title></Head>
        <div className="login-wrap">
          <div className="login-card">
            <div style={{ fontFamily:'var(--mono)', fontSize:12, color:'var(--accent)', letterSpacing:'0.1em', marginBottom:8 }}>FLEETOPS / RIDER PORTAL</div>
            <h1 style={{ fontSize:24, fontWeight:600, marginBottom:4 }}>Rider Login</h1>
            <p style={{ color:'var(--muted)', marginBottom:28 }}>Enter your NB number and email or phone</p>
            {loginErr && <div className="alert alert-danger"><i className="ti ti-alert-circle" /> {loginErr}</div>}
            <div className="form-group">
              <label className="form-label">NB Number</label>
              <input className="form-input" placeholder="e.g. NB1001" value={nb} onChange={e => setNb(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <div className="form-group">
              <label className="form-label">Email or Phone</label>
              <input className="form-input" placeholder="your@email.com or +44..." value={contact} onChange={e => setContact(e.target.value)} onKeyDown={e => e.key==='Enter' && login()} />
            </div>
            <button className="btn btn-primary" style={{ width:'100%', justifyContent:'center', marginTop:8 }} onClick={login} disabled={loginLoading}>
              {loginLoading ? <span className="spinner" /> : <><i className="ti ti-login" /> Login</>}
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <>
      <Head><title>FleetOps – Rider Portal</title></Head>
      <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh' }}>

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-logo">FLEET<span>OPS</span></div>
          <span style={{ background:'rgba(79,124,255,0.15)', color:'var(--accent)', padding:'4px 10px', borderRadius:6, fontSize:12, fontFamily:'var(--mono)' }}>{rider.nb}</span>
          <span style={{ color:'var(--text)', fontWeight:500 }}>{rider.name}</span>
          <button className="btn btn-ghost btn-sm" style={{ marginLeft:'auto' }} onClick={logout}><i className="ti ti-logout" /> Logout</button>
        </div>

        {/* Toast */}
        {msg && <div className="alert" style={{ position:'fixed', bottom:20, right:20, zIndex:300, maxWidth:320, margin:0 }} data-type={msg.type}>
          <i className={`ti ti-${msg.type==='success'?'check':'alert-circle'}`} />{msg.text}
        </div>}

        <div className="layout" style={{ minHeight:'calc(100vh - 56px)' }}>
          {/* Sidebar */}
          <div className="sidebar">
            <div style={{ padding:'10px 8px 16px', marginBottom:4 }}>
              <div style={{ fontSize:10, color:'var(--muted)', letterSpacing:'0.1em', textTransform:'uppercase', fontWeight:600 }}>Rider</div>
              <div style={{ fontWeight:600, fontSize:14, marginTop:2 }}>{rider.name}</div>
            </div>
            <div className="sidebar-label">Menu</div>
            {([
              ['shifts','calendar-event','Available Shifts'],
              ['mybookings','clipboard-list','My Bookings'],
              ['upcoming','clock','Upcoming'],
              ['notifications','bell','Notifications'],
            ] as const).map(([id, icon, label]) => (
              <button key={id} className={`nav-item ${page===id?'active':''}`} onClick={() => setPage(id as any)}>
                <i className={`ti ti-${icon}`} /><span className="nav-text">{label}</span>
                {id==='notifications' && <span className="notif-count">1</span>}
              </button>
            ))}
            <div style={{ marginTop:'auto' }}>
              <button className="nav-item" style={{ color:'var(--danger)' }} onClick={logout}><i className="ti ti-logout" /><span className="nav-text">Logout</span></button>
            </div>
          </div>

          {/* Content */}
          <div className="content">

            {/* Available Shifts */}
            {page === 'shifts' && <>
              <div className="page-title">Available Shifts</div>
              <p className="page-sub">Select a date, then book an open shift</p>
              <div className="date-tabs">
                {getNext7Days().map(d => {
                  const dk = d.toISOString().split('T')[0]
                  return (
                    <div key={dk} className={`date-tab ${selectedDate===dk?'active':''}`} onClick={() => setSelectedDate(dk)}>
                      <div className="day">{DAYS[d.getDay()]}</div>
                      <div className="num">{d.getDate()}</div>
                    </div>
                  )
                })}
              </div>
              {loading && <div style={{ textAlign:'center', padding:40 }}><span className="spinner" /></div>}
              {!loading && dayShifts.length === 0 && <div className="empty"><i className="ti ti-calendar-off" /><p>No shifts for this date</p></div>}
              <div className="shift-grid">
                {dayShifts.map(s => {
                  const pct = Math.round(s.booked / s.capacity * 100)
                  const fillClass = pct>=100?'high':pct>=70?'mid':'low'
                  const isBooked = bookedShiftIds.has(s.id)
                  const isFull = s.booked >= s.capacity
                  const myBk = myConfirmed.find(b => b.shiftId === s.id)
                  return (
                    <div key={s.id} className={`shift-card ${isBooked?'booked':''} ${isFull&&!isBooked?'full':''}`}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:8 }}>
                        <div>
                          <div className="shift-time">{s.start} – {s.end}</div>
                          <div style={{ fontSize:12, color:'var(--muted)' }}>{s.day} · {s.hours}h · {s.notes}</div>
                        </div>
                        <span className={`badge ${isFull?'badge-red':isBooked?'badge-blue':'badge-green'}`}>{isFull?'FULL':isBooked?'BOOKED':'OPEN'}</span>
                      </div>
                      <div className="cap-bar"><div className={`cap-fill ${fillClass}`} style={{ width:`${Math.min(pct,100)}%` }} /></div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--muted)' }}>
                        <span>{s.booked}/{s.capacity} slots filled</span>
                        <span className="rider-tag">{s.id}</span>
                      </div>
                      {!isBooked && !isFull && (
                        <button className="btn btn-success btn-sm" style={{ width:'100%', justifyContent:'center', marginTop:12 }} onClick={() => bookShift(s.id)} disabled={loading}>
                          <i className="ti ti-check" /> Book This Shift
                        </button>
                      )}
                      {isBooked && myBk && (
                        <button className="btn btn-danger btn-sm" style={{ width:'100%', justifyContent:'center', marginTop:12 }} onClick={() => { setCancelTarget({ bookingId:myBk.id, reason:'' }); setModal('cancel') }}>
                          <i className="ti ti-x" /> Cancel Booking
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </>}

            {/* My Bookings */}
            {page === 'mybookings' && <>
              <div className="page-title">My Bookings</div>
              <p className="page-sub">All your shift bookings</p>
              {myBookings.length === 0 && <div className="empty"><i className="ti ti-clipboard-off" /><p>No bookings yet</p></div>}
              {myBookings.map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                return (
                  <div key={b.id} className="card" style={{ display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:12 }}>
                    <div>
                      <div style={{ fontWeight:600, marginBottom:4 }}>{s?.date || b.shiftId} {s ? `· ${s.start} – ${s.end}` : ''}</div>
                      <div style={{ color:'var(--muted)', fontSize:13 }}>{s?.notes || ''} <span className="rider-tag">{b.shiftId}</span></div>
                      {b.cancelReason && <div style={{ fontSize:12, color:'var(--danger)', marginTop:4 }}><i className="ti ti-message" /> {b.cancelReason}</div>}
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <span className={`badge ${b.status==='Confirmed'?'badge-blue':'badge-red'}`}>{b.status}</span>
                      {b.status==='Confirmed' && (
                        <button className="btn btn-danger btn-sm" onClick={() => { setCancelTarget({ bookingId:b.id, reason:'' }); setModal('cancel') }}>
                          <i className="ti ti-x" /> Cancel
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </>}

            {/* Upcoming */}
            {page === 'upcoming' && <>
              <div className="page-title">Upcoming Shifts</div>
              <p className="page-sub">Your confirmed upcoming shifts</p>
              {myConfirmed.length === 0 && <div className="empty"><i className="ti ti-calendar-off" /><p>No upcoming shifts</p></div>}
              {myConfirmed.map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                if (!s) return null
                return (
                  <div key={b.id} className="card">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div>
                        <div className="shift-time">{s.start} – {s.end}</div>
                        <div style={{ color:'var(--muted)', fontSize:13 }}>{s.date} · {s.day} · {s.notes}</div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div className="badge badge-green"><span className="live-dot" style={{ width:6, height:6 }} /> Upcoming</div>
                        <div style={{ fontSize:12, color:'var(--muted)', marginTop:6 }}>{s.hours}h shift</div>
                      </div>
                    </div>
                    <div className="alert alert-info" style={{ marginTop:12, fontSize:12 }}>
                      <i className="ti ti-bell" /> You will receive an email/SMS reminder 1 hour before your shift starts
                    </div>
                  </div>
                )
              })}
            </>}

            {/* Notifications */}
            {page === 'notifications' && <>
              <div className="page-title">Notifications</div>
              <p className="page-sub">Shift reminders and system alerts</p>
              <div className="card">
                <div style={{ display:'flex', gap:12 }}>
                  <i className="ti ti-bell" style={{ color:'var(--accent)', fontSize:20, flexShrink:0 }} />
                  <div>
                    <div style={{ fontWeight:500, marginBottom:4 }}>Shift Reminder System Active</div>
                    <div style={{ color:'var(--muted)', fontSize:13 }}>You will automatically receive an email or SMS 1 hour before each booked shift starts. Make sure your email and phone are correct with your admin.</div>
                  </div>
                </div>
              </div>
              {myConfirmed.length > 0 && myConfirmed.map(b => {
                const s = shifts.find(x => x.id === b.shiftId)
                if (!s) return null
                return (
                  <div key={b.id} className="card">
                    <div style={{ display:'flex', gap:12 }}>
                      <i className="ti ti-clock" style={{ color:'var(--accent2)', fontSize:20, flexShrink:0 }} />
                      <div>
                        <div style={{ marginBottom:4 }}>Reminder scheduled for <strong>{s.date} at {s.start.split(':')[0]}:{s.start.split(':')[1].padEnd(2,'0')} (1 hour before)</strong></div>
                        <div style={{ fontSize:12, color:'var(--muted)' }}>Shift: {s.start} – {s.end} · {s.notes}</div>
                      </div>
                    </div>
                  </div>
                )
              })}
              {myCancelled.length > 0 && (
                <div className="alert alert-warning">
                  <i className="ti ti-alert-triangle" /> You have {myCancelled.length} cancellation(s) this week. Limit is 5 per week.
                </div>
              )}
            </>}

          </div>
        </div>

        {/* Cancel Modal */}
        {modal === 'cancel' && cancelTarget && (
          <div className="modal-overlay" onClick={() => setModal(null)}>
            <div className="modal" onClick={e => e.stopPropagation()}>
              <div className="modal-title">Cancel Booking</div>
              <div className="modal-sub">Please provide a reason for cancellation</div>
              <div className="alert alert-warning">
                <i className="ti ti-alert-triangle" /> You have {5 - myCancelled.length} cancellations remaining this week (max 5)
              </div>
              <div className="form-group">
                <label className="form-label">Cancellation Reason</label>
                <select className="form-input" value={cancelTarget.reason} onChange={e => setCancelTarget({ ...cancelTarget, reason: e.target.value })}>
                  <option value="">Select a reason...</option>
                  <option>Personal emergency</option>
                  <option>Vehicle issue</option>
                  <option>Medical appointment</option>
                  <option>Family matter</option>
                  <option>Work conflict</option>
                  <option>Other</option>
                </select>
              </div>
              <div className="modal-actions">
                <button className="btn btn-ghost" onClick={() => setModal(null)}>Keep Booking</button>
                <button className="btn btn-danger" onClick={cancelBooking} disabled={loading}>
                  {loading ? <span className="spinner" /> : <><i className="ti ti-x" /> Confirm Cancel</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
