import { useState, useEffect, useCallback, useMemo } from 'react'
import Head from 'next/head'
import {
  LayoutDashboard, Radio, Calendar, Receipt, Users, BarChart3,
  LogOut, Plus, Edit, Trash2, Copy, Download, RefreshCw, Shield,
  TrendingUp, Activity, Clock, AlertTriangle, CheckCircle, XCircle,
  Search, ChevronRight, Timer, MapPin, UserCheck, UserX, Building2,
  Globe, Zap,
} from 'lucide-react'
import { Spinner, Toast, Modal, ProgressRing, EmptyState, Avatar, KpiCard, Skeleton } from '../components/ui'
import Layout from '../components/Layout'

const DAYS   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const CITIES = ['Berlin', 'Munich', 'Frankfurt', 'Stuttgart'] as const
type City = typeof CITIES[number]

const CITY_COLORS: Record<string,{bg:string;text:string;border:string;accent:string}> = {
  Berlin:    { bg:'rgba(59,130,246,0.15)',  text:'#93c5fd', border:'rgba(59,130,246,0.3)',  accent:'#3b82f6' },
  Munich:    { bg:'rgba(16,185,129,0.15)',  text:'#6ee7b7', border:'rgba(16,185,129,0.3)',  accent:'#10b981' },
  Frankfurt: { bg:'rgba(245,158,11,0.15)',  text:'#fcd34d', border:'rgba(245,158,11,0.3)',  accent:'#f59e0b' },
  Stuttgart: { bg:'rgba(167,139,250,0.15)', text:'#c4b5fd', border:'rgba(167,139,250,0.3)', accent:'#8b5cf6' },
}
function cityStyle(city: string) {
  return CITY_COLORS[city] || { bg:'rgba(148,163,184,0.1)', text:'#94a3b8', border:'rgba(148,163,184,0.2)', accent:'#94a3b8' }
}

function fmt12(t:string) {
  if (!t||t==='00:00') return '—'
  const [h,m]=t.split(':').map(Number)
  if (isNaN(h)) return t
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}
function fmtDate(d:string) {
  if (!d) return '—'
  const dt=new Date(d+'T00:00:00')
  if (isNaN(dt.getTime())) return d
  return `${DAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`
}

type Rider   = { nb:string; name:string; city:string; phone:string; email:string; active:boolean; weeklyHours:number; cancellations:number }
type Shift   = { id:string; city:string; date:string; day:string; start:string; end:string; hours:number; capacity:number; booked:number; status:string; notes:string }
type Booking = { id:string; riderNb:string; riderName:string; city:string; shiftId:string; shiftDate:string; day:string; startTime:string; endTime:string; hours:number; status:string; cancelReason:string; createdAt:string; updatedAt:string }

export default function AdminPortal() {
  const [authed,       setAuthed]       = useState(false)
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [loginErr,     setLoginErr]     = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [page,         setPage]         = useState<'dashboard'|'live'|'shifts'|'bookings'|'users'|'hours'>('dashboard')
  const [riders,       setRiders]       = useState<Rider[]>([])
  const [shifts,       setShifts]       = useState<Shift[]>([])
  const [bookings,     setBookings]     = useState<Booking[]>([])
  const [loading,      setLoading]      = useState(false)
  const [syncing,      setSyncing]      = useState(false)
  const [lastSync,     setLastSync]     = useState<Date|null>(null)
  const [syncError,    setSyncError]    = useState<string|null>(null)
  const [toast,        setToast]        = useState<{type:any;message:string}|null>(null)
  const [modal,        setModal]        = useState<null|'addRider'|'addShift'|'editShift'|'editRider'>(null)
  const [editTarget,   setEditTarget]   = useState<any>(null)
  const [form,         setForm]         = useState<any>({})
  const [search,       setSearch]       = useState('')
  const [cityFilter,   setCityFilter]   = useState('')
  const [bookingFilter,setBookingFilter]= useState('')
  const [bookingPage,  setBookingPage]  = useState(1)
  const [riderPage,    setRiderPage]    = useState(1)
  const [shiftPage,    setShiftPage]    = useState(1)
  const PAGE_SIZE = 50

  const showToast = (type:any, message:string) => setToast({type,message})

  const loadAll = useCallback(async (silent=false) => {
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [rRes,sRes,bRes] = await Promise.all([fetch('/api/riders'),fetch('/api/shifts'),fetch('/api/bookings')])
      if (rRes.ok) { const d=await rRes.json(); setRiders(Array.isArray(d)?d:[]) }
      if (sRes.ok) { const d=await sRes.json(); setShifts(Array.isArray(d)?d:[]) }
      if (bRes.ok) { const d=await bRes.json(); setBookings(Array.isArray(d)?d:[]) }
      setLastSync(new Date()); setSyncError(null)
    } catch (e:any) {
      setSyncError('Sync failed ' + new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}))
      if (!silent) showToast('error','Failed to sync with Google Sheets')
    } finally { setLoading(false); setSyncing(false) }
  }, [])

  useEffect(() => {
    if (!authed) return
    loadAll()
    const t = setInterval(()=>loadAll(true), 20000)
    return ()=>clearInterval(t)
  }, [authed, loadAll])

  async function login() {
    setLoginLoading(true); setLoginErr('')
    try {
      const res=await fetch('/api/auth/admin-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})})
      const data=await res.json()
      if (!res.ok) { setLoginErr(data.error||'Invalid credentials'); return }
      setAuthed(true)
    } catch { setLoginErr('Network error') }
    finally { setLoginLoading(false) }
  }
  async function logout() { await fetch('/api/auth/logout',{method:'POST'}); setAuthed(false) }

  const api = async (method:string, url:string, body?:any) => {
    const res=await fetch(url,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined})
    const data=await res.json()
    if (!res.ok) throw new Error(data.error)
    return data
  }

  async function addRider()     { try { await api('POST','/api/riders',form); showToast('success',`Rider ${form.nb} added`); setModal(null); setForm({}); loadAll(true) } catch(e:any){showToast('error',e.message)} }
  async function saveEditRider(){ try { await api('PATCH','/api/riders',{nb:editTarget.nb,...form}); showToast('success','Rider updated'); setModal(null); setForm({}); loadAll(true) } catch(e:any){showToast('error',e.message)} }
  async function toggleRider(nb:string,active:boolean){ try { await api('PATCH','/api/riders',{nb,active}); showToast('success',`Rider ${active?'activated':'disabled'}`); loadAll(true) } catch(e:any){showToast('error',e.message)} }
  async function addShift()     { if(!form.date||!form.start||!form.end){showToast('error','Date, start and end required');return} try { const d=await api('POST','/api/shifts',form); showToast('success',`Shift ${d.id} created`); setModal(null); setForm({}); loadAll(true) } catch(e:any){showToast('error',e.message)} }
  async function saveEditShift(){ try { await api('PATCH','/api/shifts',{id:editTarget.id,...form}); showToast('success','Shift updated'); setModal(null); setForm({}); loadAll(true) } catch(e:any){showToast('error',e.message)} }
  async function deleteShift(id:string){ if(!confirm('Delete this shift?')) return; try { await api('DELETE','/api/shifts',{id}); showToast('success','Deleted'); loadAll(true) } catch(e:any){showToast('error',e.message)} }
  async function duplicateShift(s:Shift){ try { const d=await api('POST','/api/shifts',{date:s.date,start:s.start,end:s.end,capacity:s.capacity,notes:s.notes,city:s.city}); showToast('success',`Duplicated as ${d.id}`); loadAll(true) } catch(e:any){showToast('error',e.message)} }

  function exportCSV() {
    const rows=[['Booking_ID','MB_No','Rider_Name','City','Shift_ID','Date','Day','Start','End','Hours','Status','Cancel_Reason','Created_At']]
    filteredBookings.forEach(b=>rows.push([b.id,b.riderNb,b.riderName||'',b.city||'',b.shiftId,b.shiftDate||'',b.day||'',b.startTime||'',b.endTime||'',String(b.hours||''),b.status,b.cancelReason||'',b.createdAt||'']))
    const csv=rows.map(r=>r.map(x=>`"${x}"`).join(',')).join('\n')
    const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'})); a.download=`fleetops_${cityFilter||'all'}_${new Date().toISOString().split('T')[0]}.csv`; a.click()
    showToast('success','CSV exported')
  }

  const now      = new Date()
  const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
  const nowMins  = now.getHours()*60+now.getMinutes()
  const toMins   = (t:string)=>{ const [h,m]=t.split(':').map(Number); return h*60+m }

  function getShiftStatus(s:Shift) {
    if (s.date!==todayStr) return 'scheduled'
    const sm=toMins(s.start), em=toMins(s.end)
    if (nowMins<sm-30) return 'scheduled'
    if (nowMins>=sm-30&&nowMins<sm) return 'starting_soon'
    if (nowMins>=sm&&nowMins<=em-15) return 'active'
    if (nowMins>em-15&&nowMins<=em) return 'ending_soon'
    if (nowMins>em) return 'completed'
    return 'scheduled'
  }

  const liveBookings = bookings.filter(b => {
    if (b.status!=='Confirmed') return false
    const s=shifts.find(x=>x.id===b.shiftId)
    if (!s||s.date!==todayStr) return false
    const st=getShiftStatus(s)
    return st==='active'||st==='starting_soon'||st==='ending_soon'
  })

  // City-filtered data
  const applyCity = (arr: any[], key='city') => cityFilter ? arr.filter((x:any)=>x[key]===cityFilter) : arr

  const filteredRiders   = useMemo(()=>riders.filter(r=>(!cityFilter||r.city===cityFilter)&&(!search||r.name.toLowerCase().includes(search.toLowerCase())||r.nb.toLowerCase().includes(search.toLowerCase()))), [riders,cityFilter,search])
  const filteredShifts   = useMemo(()=>shifts.filter(s=>(!cityFilter||s.city===cityFilter)&&(!search||s.id.toLowerCase().includes(search.toLowerCase())||(s.notes||'').toLowerCase().includes(search.toLowerCase())||s.date.includes(search))), [shifts,cityFilter,search])
  const filteredBookings = useMemo(()=>bookings.filter(b=>{
    const r=riders.find(x=>x.nb===b.riderNb)
    const matchCity=!cityFilter||b.city===cityFilter
    const matchSearch=!search||(r?.name||'').toLowerCase().includes(search.toLowerCase())||(b.riderNb||'').toLowerCase().includes(search.toLowerCase())||(b.riderName||'').toLowerCase().includes(search.toLowerCase())||(b.shiftId||'').toLowerCase().includes(search.toLowerCase())||(b.shiftDate||'').includes(search)
    return matchCity&&matchSearch&&(!bookingFilter||b.status===bookingFilter)
  }), [bookings,riders,cityFilter,search,bookingFilter])

  const totalBooked   = shifts.reduce((a,s)=>a+s.booked,0)
  const totalCapacity = shifts.reduce((a,s)=>a+s.capacity,0)
  const utilizationPct = totalCapacity?Math.round(totalBooked/totalCapacity*100):0

  // Per-city stats
  const cityStats = useMemo(()=>CITIES.map(city=>{
    const cRiders   = riders.filter(r=>r.city===city)
    const cShifts   = shifts.filter(s=>s.city===city)
    const cBookings = bookings.filter(b=>b.city===city)
    const cap       = cShifts.reduce((a,s)=>a+s.capacity,0)
    const bkd       = cShifts.reduce((a,s)=>a+s.booked,0)
    return {
      city,
      totalRiders:  cRiders.length,
      activeRiders: cRiders.filter(r=>r.active).length,
      totalShifts:  cShifts.length,
      fullShifts:   cShifts.filter(s=>s.status==='FULL').length,
      openSlots:    cShifts.reduce((a,s)=>a+(s.capacity-s.booked),0),
      cancelled:    cBookings.filter(b=>b.status==='Cancelled').length,
      confirmed:    cBookings.filter(b=>b.status==='Confirmed').length,
      utilization:  cap?Math.round(bkd/cap*100):0,
      totalHours:   cBookings.filter(b=>b.status==='Confirmed').reduce((a,b)=>a+(Number(b.hours)||0),0),
    }
  }), [riders,shifts,bookings])

  // ── LOGIN ──────────────────────────────────────────────────
  if (!authed) {
    return (
      <>
        <Head><title>FleetOps — Admin</title></Head>
        <div className="app-bg" aria-hidden><div className="app-grid"/><div className="app-scanline"/></div>
        {toast&&<Toast type={toast.type} message={toast.message} onClose={()=>setToast(null)}/>}
        <div className="login-wrap">
          <div className="login-card anim-up" style={{borderColor:'rgba(124,58,237,0.2)',boxShadow:'0 32px 80px rgba(0,0,0,0.5),0 0 60px rgba(109,40,217,0.08)'}}>
            <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:28}}>
              <div className="logo-icon" style={{width:42,height:42,borderRadius:13,background:'linear-gradient(135deg,#7c3aed,#4c1d95)'}}>
                <Shield size={20} color="#fff"/>
              </div>
              <div>
                <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:17,color:'#f1f5ff'}}>FleetOps</div>
                <div style={{fontSize:11,color:'#a78bfa',fontWeight:600,letterSpacing:'0.12em',textTransform:'uppercase'}}>Admin Console</div>
              </div>
            </div>
            <h1 style={{fontSize:26,fontWeight:800,color:'#f1f5ff',letterSpacing:'-0.5px',marginBottom:4}}>Admin Login</h1>
            <p style={{fontSize:13.5,color:'rgba(100,116,139,0.85)',marginBottom:28}}>Restricted to authorised administrators only</p>
            {loginErr&&<div className="alert alert-danger" style={{marginBottom:20}}><XCircle size={15} style={{flexShrink:0}}/>{loginErr}</div>}
            <div style={{marginBottom:16}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Email</label>
              <input type="email" className="input-field" placeholder="admin@yourcompany.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/>
            </div>
            <div style={{marginBottom:24}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Password</label>
              <input type="password" className="input-field" placeholder="••••••••" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()}/>
            </div>
            <button onClick={login} disabled={loginLoading} style={{width:'100%',justifyContent:'center',padding:'13px',borderRadius:14,fontSize:15,display:'flex',alignItems:'center',gap:8,fontWeight:700,color:'#fff',border:'none',cursor:'pointer',background:'linear-gradient(135deg,#7c3aed,#4c1d95)',boxShadow:'0 0 24px rgba(124,58,237,0.45)'}}>
              {loginLoading?<><Spinner size={16}/>Signing in...</>:<><Shield size={16}/>Sign In to Admin</>}
            </button>
            <div style={{marginTop:20,padding:'12px 14px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:12,fontSize:12,color:'rgba(100,116,139,0.55)',display:'flex',gap:8,alignItems:'flex-start'}}>
              <Shield size={13} style={{flexShrink:0,marginTop:1}}/> Riders access <code style={{color:'rgba(148,163,184,0.6)',margin:'0 3px'}}>/rider</code> — they cannot reach this page.
            </div>
          </div>
        </div>
      </>
    )
  }

  const navItems = [
    {id:'dashboard', label:'Dashboard',  icon:LayoutDashboard},
    {id:'live',      label:'Live Now',   icon:Radio, badge:liveBookings.length>0?liveBookings.length:undefined},
    {id:'shifts',    label:'Shifts',     icon:Calendar},
    {id:'bookings',  label:'Bookings',   icon:Receipt},
    {id:'users',     label:'Riders',     icon:Users},
    {id:'hours',     label:'Hours',      icon:BarChart3},
  ]

  const sidebarBottom = (
    <>
      <button onClick={()=>loadAll(true)} disabled={syncing} className="nav-item" style={{color:'rgba(148,163,184,0.6)',marginBottom:2}}>
        <RefreshCw size={15} style={{animation:syncing?'spin 0.8s linear infinite':'none'}}/><span>{syncing?'Syncing…':'Refresh Data'}</span>
      </button>
      <button className="nav-item" style={{color:'rgba(251,113,133,0.8)'}} onClick={logout}><LogOut size={15}/><span>Logout</span></button>
    </>
  )

  const topbarRight = (
    <div style={{display:'flex',alignItems:'center',gap:10}}>
      {syncError&&<span style={{fontSize:11,color:'#fb7185',background:'rgba(244,63,94,0.1)',border:'1px solid rgba(244,63,94,0.25)',padding:'3px 8px',borderRadius:6}}>⚠ Sync error</span>}
      {!syncError&&lastSync&&<span style={{fontSize:11,color:'rgba(100,116,139,0.5)'}}>Synced {lastSync.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}</span>}
      {/* City filter pill */}
      <div style={{display:'flex',gap:6,alignItems:'center'}}>
        <button onClick={()=>{setCityFilter('');setBookingPage(1);setRiderPage(1);setShiftPage(1)}}
          style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,cursor:'pointer',border:'1px solid',background:!cityFilter?'rgba(148,163,184,0.15)':'transparent',color:!cityFilter?'#e1e7f5':'rgba(100,116,139,0.6)',borderColor:!cityFilter?'rgba(148,163,184,0.3)':'rgba(100,116,139,0.2)'}}>
          All
        </button>
        {CITIES.map(c=>{const cs=cityStyle(c); return (
          <button key={c} onClick={()=>{setCityFilter(c===cityFilter?'':c);setBookingPage(1);setRiderPage(1);setShiftPage(1)}}
            style={{fontSize:11,fontWeight:600,padding:'3px 10px',borderRadius:20,cursor:'pointer',border:`1px solid`,background:cityFilter===c?cs.bg:'transparent',color:cityFilter===c?cs.text:'rgba(100,116,139,0.6)',borderColor:cityFilter===c?cs.border:'rgba(100,116,139,0.2)'}}>
            {c}
          </button>
        )})}
      </div>
      <span style={{fontSize:11,fontWeight:600,color:'#fb7185',background:'rgba(244,63,94,0.1)',border:'1px solid rgba(244,63,94,0.2)',padding:'3px 9px',borderRadius:20,display:'flex',alignItems:'center',gap:5}}><Shield size={10}/>Admin</span>
      <button className="btn-ghost btn-sm" onClick={exportCSV}><Download size={13}/>Export</button>
    </div>
  )

  const TH = ({children}:any) => <th style={{textAlign:'left',padding:'11px 16px',fontSize:10.5,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.7)',background:'rgba(255,255,255,0.025)',borderBottom:'1px solid rgba(255,255,255,0.055)',whiteSpace:'nowrap'}}>{children}</th>
  const TD = ({children,style={}}:any) => <td style={{padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,0.04)',verticalAlign:'middle',...style}}>{children}</td>

  const CityBadge = ({city}:{city:string}) => {
    if (!city) return null
    const cs=cityStyle(city)
    return <span style={{padding:'2px 8px',borderRadius:6,background:cs.bg,color:cs.text,border:`1px solid ${cs.border}`,fontSize:11,fontWeight:600,whiteSpace:'nowrap'}}>{city}</span>
  }

  return (
    <>
      <Head><title>FleetOps — Admin Console</title></Head>
      {toast&&<Toast type={toast.type} message={toast.message} onClose={()=>setToast(null)}/>}

      <Layout navItems={navItems} activePage={page} onNav={p=>setPage(p as any)}
        topbarRight={topbarRight} sidebarBottom={sidebarBottom}
        portalLabel="Admin" portalColor="#a78bfa">

        {/* ══ DASHBOARD ══════════════════════════════════ */}
        {page==='dashboard' && (
          <div className="anim-fade">
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
              <div>
                <h1 className="page-title">Operations Dashboard</h1>
                <p className="page-sub">{now.toLocaleDateString('en-GB',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
              </div>
              {liveBookings.length>0&&(
                <button onClick={()=>setPage('live')} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 16px',borderRadius:20,background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',color:'#34d399',fontSize:13,fontWeight:600,cursor:'pointer'}}>
                  <span className="live-pulse"><span className="live-pulse-dot" style={{width:7,height:7}}/><span className="live-pulse-ring"/></span>
                  {liveBookings.length} rider{liveBookings.length>1?'s':''} on shift <ChevronRight size={14}/>
                </button>
              )}
            </div>

            {/* Global KPIs */}
            {loading ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:24}}>{[1,2,3,4,5,6].map(i=><Skeleton key={i} style={{height:110}}/>)}</div> : (
              <div className="stagger-children" style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:24}}>
                <KpiCard label="Total Riders"  value={riders.length}              sub={`${riders.filter(r=>r.active).length} active`}     color="blue"   icon={Users}/>
                <KpiCard label="Live Now"       value={liveBookings.length}        sub="on shift"                                          color="green"  icon={Activity}/>
                <KpiCard label="Total Shifts"   value={shifts.length}              sub={`${shifts.filter(s=>s.status==='FULL').length} full`} color="violet" icon={Calendar}/>
                <KpiCard label="Utilization"    value={`${utilizationPct}%`}       sub={`${totalBooked}/${totalCapacity} slots`}           color="cyan"   icon={TrendingUp}/>
                <KpiCard label="Cancellations"  value={bookings.filter(b=>b.status==='Cancelled').length} sub="total"                      color="amber"  icon={XCircle}/>
                <KpiCard label="Open Slots"     value={shifts.reduce((a,s)=>a+(s.capacity-s.booked),0)} sub="available"                   color="rose"   icon={Timer}/>
              </div>
            )}

            {/* City Cards */}
            <h2 style={{fontSize:16,fontWeight:700,color:'#e1e7f5',marginBottom:14,display:'flex',alignItems:'center',gap:8}}><Globe size={16} color="#a78bfa"/>City Overview</h2>
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))',gap:14,marginBottom:24}}>
              {cityStats.map(cs=>{
                const c=cityStyle(cs.city)
                return (
                  <div key={cs.city} className="glass-card" style={{padding:'18px 20px',border:`1px solid ${c.border}`,background:`linear-gradient(135deg,${c.bg},rgba(8,15,32,0.6))`}}>
                    <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <Building2 size={18} color={c.text}/>
                        <span style={{fontWeight:700,fontSize:16,color:c.text}}>{cs.city}</span>
                      </div>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:c.text}}>{cs.utilization}%</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:14}}>
                      {[
                        {l:'Riders',      v:cs.totalRiders,  s:`${cs.activeRiders} active`},
                        {l:'Shifts',      v:cs.totalShifts,  s:`${cs.fullShifts} full`},
                        {l:'Confirmed',   v:cs.confirmed,    s:`bookings`},
                        {l:'Open Slots',  v:cs.openSlots,    s:`available`},
                      ].map(stat=>(
                        <div key={stat.l} style={{background:'rgba(0,0,0,0.2)',borderRadius:10,padding:'10px 12px'}}>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,color:'#f1f5ff'}}>{stat.v}</div>
                          <div style={{fontSize:10,color:'rgba(100,116,139,0.7)',textTransform:'uppercase',letterSpacing:'0.08em'}}>{stat.l}</div>
                          <div style={{fontSize:10,color:'rgba(100,116,139,0.5)'}}>{stat.s}</div>
                        </div>
                      ))}
                    </div>
                    {/* Utilization bar */}
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(100,116,139,0.7)',marginBottom:6}}>
                      <span>Utilization</span><span>{cs.totalHours.toFixed(0)}h booked</span>
                    </div>
                    <div className="progress-track" style={{height:5}}>
                      <div className="progress-fill" style={{width:`${cs.utilization}%`,background:`linear-gradient(90deg,${c.accent}80,${c.accent})`}}/>
                    </div>
                    {cs.utilization>=90&&<div style={{fontSize:11,color:'#fcd34d',marginTop:8,display:'flex',alignItems:'center',gap:4}}><span>🔥</span>High demand</div>}
                    {cs.openSlots===0&&cs.totalShifts>0&&<div style={{fontSize:11,color:'#fb7185',marginTop:8,display:'flex',alignItems:'center',gap:4}}><AlertTriangle size={11}/>All shifts full</div>}
                    {cs.totalRiders===0&&<div style={{fontSize:11,color:'rgba(100,116,139,0.6)',marginTop:8,display:'flex',alignItems:'center',gap:4}}><Users size={11}/>No riders assigned</div>}
                  </div>
                )
              })}
            </div>

            {/* Recent bookings + fill rates */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
              <div className="glass-card" style={{padding:'20px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
                  <span style={{fontSize:15,fontWeight:700,color:'#e1e7f5'}}>Recent Bookings</span>
                  <button onClick={()=>setPage('bookings')} style={{fontSize:12,color:'#60a5fa',background:'none',border:'none',cursor:'pointer'}}>View all →</button>
                </div>
                {bookings.slice(-6).reverse().map((b,i)=>{
                  const r=riders.find(x=>x.nb===b.riderNb)
                  const cs2=cityStyle(b.city)
                  return <div key={b.id} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:i<5?'1px solid rgba(255,255,255,0.04)':'none'}}>
                    <Avatar name={b.riderName||b.riderNb} size="sm"/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,fontWeight:500,color:'#e1e7f5',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.riderName||r?.name||b.riderNb}</div>
                      <div style={{fontSize:11,color:'rgba(100,116,139,0.65)',display:'flex',alignItems:'center',gap:5}}>
                        {b.shiftId} {b.city&&<span style={{padding:'0 5px',borderRadius:4,background:cs2.bg,color:cs2.text,fontSize:10}}>{b.city}</span>}
                      </div>
                    </div>
                    <span className={`badge ${b.status==='Confirmed'?'badge-blue':'badge-red'}`}>{b.status}</span>
                  </div>
                })}
              </div>
              <div className="glass-card" style={{padding:'20px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:18}}>
                  <span style={{fontSize:15,fontWeight:700,color:'#e1e7f5'}}>Shift Fill Rates</span>
                  <button onClick={()=>setPage('shifts')} style={{fontSize:12,color:'#60a5fa',background:'none',border:'none',cursor:'pointer'}}>Manage →</button>
                </div>
                {shifts.slice(0,7).map(s=>{
                  const pct=s.capacity>0?Math.round(s.booked/s.capacity*100):0
                  const col=pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981'
                  const cs2=cityStyle(s.city)
                  return <div key={s.id} style={{marginBottom:12}}>
                    <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:5,alignItems:'center'}}>
                      <span style={{color:'rgba(148,163,184,0.7)',display:'flex',alignItems:'center',gap:5}}>
                        {s.city&&<span style={{padding:'0 5px',borderRadius:4,background:cs2.bg,color:cs2.text,fontSize:10}}>{s.city}</span>}
                        {s.id} · {fmt12(s.start)}–{fmt12(s.end)}
                      </span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:col}}>{pct}%</span>
                    </div>
                    <div className="progress-track" style={{height:4,margin:0}}><div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,background:`linear-gradient(90deg,${col}90,${col})`}}/></div>
                  </div>
                })}
              </div>
            </div>
          </div>
        )}

        {/* ══ LIVE NOW ════════════════════════════════════ */}
        {page==='live' && (
          <div className="anim-fade">
            <h1 className="page-title">Live Active Riders</h1>
            <p className="page-sub">Riders currently on shift — auto-refreshes every 20s</p>
            {liveBookings.length===0
              ? <EmptyState icon={Radio} title="No active shifts" description="No riders are currently on shift."/>
              : <>
                <div className="alert alert-success" style={{marginBottom:20}}>
                  <span className="live-pulse"><span className="live-pulse-dot"/><span className="live-pulse-ring"/></span>
                  <strong>{liveBookings.length}</strong> rider{liveBookings.length>1?'s':''} on shift as of {now.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})}
                </div>
                {/* Group by city */}
                {(cityFilter?[cityFilter]:Array.from(new Set(liveBookings.map(b=>{const s=shifts.find(x=>x.id===b.shiftId); return b.city||s?.city||'Unknown'})))).map(city=>{
                  const cityLive=liveBookings.filter(b=>{const s=shifts.find(x=>x.id===b.shiftId); return (b.city||s?.city||'Unknown')===city})
                  if (!cityLive.length) return null
                  const cs2=cityStyle(city)
                  return (
                    <div key={city} style={{marginBottom:24}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'8px 12px',borderRadius:10,background:cs2.bg,border:`1px solid ${cs2.border}`,width:'fit-content'}}>
                        <Building2 size={14} color={cs2.text}/><span style={{fontWeight:700,fontSize:14,color:cs2.text}}>{city}</span>
                        <span style={{fontSize:12,color:cs2.text,opacity:0.7}}>· {cityLive.length} active</span>
                      </div>
                      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:14}}>
                        {cityLive.map(b=>{
                          const r=riders.find(x=>x.nb===b.riderNb)
                          const s=shifts.find(x=>x.id===b.shiftId)
                          const minsLeft=s?Math.max(0,toMins(s.end)-nowMins):0
                          const st=s?getShiftStatus(s):'active'
                          return (
                            <div key={b.id} className="glass-card" style={{padding:'20px',border:`1px solid ${st==='ending_soon'?'rgba(245,158,11,0.3)':st==='starting_soon'?'rgba(59,130,246,0.3)':'rgba(16,185,129,0.2)'}`,background:st==='ending_soon'?'rgba(180,83,9,0.06)':st==='starting_soon'?'rgba(37,99,235,0.06)':'rgba(5,150,105,0.06)'}}>
                              <div style={{display:'flex',justifyContent:'space-between',marginBottom:14}}>
                                <Avatar name={r?.name||'?'} size="lg"/>
                                <span className={`badge ${st==='ending_soon'?'badge-amber':st==='starting_soon'?'badge-blue':'badge-green'}`} style={{alignSelf:'flex-start',display:'flex',alignItems:'center',gap:5}}>
                                  {st==='ending_soon'?<><AlertTriangle size={10}/>Ending soon</>:st==='starting_soon'?<><Timer size={10}/>Starting soon</>:<><span className="live-pulse" style={{width:6,height:6}}><span className="live-pulse-dot" style={{width:6,height:6}}/><span className="live-pulse-ring" style={{inset:-2}}/></span>Active</>}
                                </span>
                              </div>
                              <div style={{fontWeight:700,fontSize:15,color:'#f1f5ff',marginBottom:2}}>{r?.name||b.riderNb}</div>
                              <span className="rider-tag" style={{marginBottom:12,display:'inline-block'}}>{b.riderNb}</span>
                              <div style={{display:'flex',flexDirection:'column',gap:5,fontSize:13,color:'rgba(148,163,184,0.75)',marginTop:10}}>
                                <span style={{display:'flex',alignItems:'center',gap:6}}><Clock size={13} color="#60a5fa"/>{fmt12(s?.start||'')} – {fmt12(s?.end||'')}</span>
                                <span style={{display:'flex',alignItems:'center',gap:6}}><MapPin size={13} color="#6ee7b7"/>{s?.notes||'—'}</span>
                                {minsLeft>0&&<span style={{display:'flex',alignItems:'center',gap:6}}><Timer size={13} color="#fcd34d"/>{minsLeft}min remaining</span>}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </>
            }
          </div>
        )}

        {/* ══ SHIFTS ═══════════════════════════════════════ */}
        {page==='shifts' && (
          <div className="anim-fade">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24,flexWrap:'wrap',gap:12}}>
              <div>
                <h1 className="page-title">Shift Management</h1>
                <p className="page-sub">Changes sync instantly to Google Sheets · {filteredShifts.length} shifts{cityFilter?` in ${cityFilter}`:''}</p>
              </div>
              <button className="btn-primary" onClick={()=>{setForm({date:todayStr,capacity:5,start:'09:00',end:'14:00',notes:'',city:cityFilter||''});setModal('addShift')}}><Plus size={15}/>Create Shift</button>
            </div>
            <div className="glass-card" style={{overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr><TH>ID</TH><TH>City</TH><TH>Date</TH><TH>Day</TH><TH>Start</TH><TH>End</TH><TH>Hrs</TH><TH>Cap</TH><TH>Booked</TH><TH>Status</TH><TH>Notes</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {filteredShifts.filter(s=>!search||s.id.toLowerCase().includes(search.toLowerCase())||(s.notes||'').toLowerCase().includes(search.toLowerCase())||s.date.includes(search)).slice((shiftPage-1)*PAGE_SIZE,shiftPage*PAGE_SIZE).map(s=>{
                      const pct=s.capacity>0?Math.round(s.booked/s.capacity*100):0
                      return (
                        <tr key={s.id} onMouseEnter={e=>(e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e=>(e.currentTarget.style.background='')} style={{transition:'background 0.12s'}}>
                          <TD><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',padding:'2px 8px',borderRadius:6,color:'rgba(148,163,184,0.75)'}}>{s.id}</span></TD>
                          <TD><CityBadge city={s.city}/></TD>
                          <TD style={{fontWeight:600,color:'#e1e7f5',whiteSpace:'nowrap'}}>{fmtDate(s.date)}</TD>
                          <TD style={{color:'rgba(148,163,184,0.65)',fontSize:12}}>{s.day}</TD>
                          <TD style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#6ee7b7',fontWeight:600}}>{fmt12(s.start)}</TD>
                          <TD style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#6ee7b7',fontWeight:600}}>{fmt12(s.end)}</TD>
                          <TD style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,color:'#93c5fd'}}>{s.hours}h</TD>
                          <TD>{s.capacity}</TD>
                          <TD>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:13,color:'#f1f5ff'}}>{s.booked}</span>
                              <div className="progress-track" style={{width:44,height:4,margin:0}}><div className="progress-fill" style={{width:`${Math.min(pct,100)}%`,background:pct>=100?'#f43f5e':pct>=70?'#f59e0b':'#10b981'}}/></div>
                              <span style={{fontSize:10,color:'rgba(100,116,139,0.6)',fontFamily:"'JetBrains Mono',monospace"}}>{pct}%</span>
                            </div>
                          </TD>
                          <TD><span className={`badge ${s.status==='FULL'?'badge-red':'badge-green'}`}>{s.status}</span></TD>
                          <TD style={{color:'rgba(100,116,139,0.65)',fontSize:12,maxWidth:110,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.notes}</TD>
                          <TD>
                            <div style={{display:'flex',gap:5}}>
                              <button className="btn-ghost btn-xs" onClick={()=>{setEditTarget(s);setForm({capacity:s.capacity,notes:s.notes,start:s.start,end:s.end,city:s.city});setModal('editShift')}} title="Edit"><Edit size={12}/></button>
                              <button className="btn-ghost btn-xs" onClick={()=>duplicateShift(s)} title="Duplicate"><Copy size={12}/></button>
                              <button className="btn-danger btn-xs" onClick={()=>deleteShift(s.id)} title="Delete"><Trash2 size={12}/></button>
                            </div>
                          </TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {filteredShifts.length>PAGE_SIZE&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',fontSize:12,color:'rgba(100,116,139,0.6)'}}>
              <span>Showing {Math.min((shiftPage-1)*PAGE_SIZE+1,filteredShifts.length)}–{Math.min(shiftPage*PAGE_SIZE,filteredShifts.length)} of {filteredShifts.length}</span>
              <div style={{display:'flex',gap:6}}>
                <button className="btn-ghost btn-xs" disabled={shiftPage===1} onClick={()=>setShiftPage(p=>p-1)}>← Prev</button>
                <span style={{padding:'4px 8px',fontSize:12,color:'rgba(148,163,184,0.7)'}}>Page {shiftPage}/{Math.ceil(filteredShifts.length/PAGE_SIZE)}</span>
                <button className="btn-ghost btn-xs" disabled={shiftPage*PAGE_SIZE>=filteredShifts.length} onClick={()=>setShiftPage(p=>p+1)}>Next →</button>
              </div>
            </div>}
          </div>
        )}

        {/* ══ BOOKINGS ═══════════════════════════════════ */}
        {page==='bookings' && (
          <div className="anim-fade">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div>
                <h1 className="page-title">Booking Management</h1>
                <p className="page-sub">Live from Google Sheets · <span style={{color:'#6ee7b7'}}>{bookings.filter(b=>b.status==='Confirmed').length} confirmed</span> · <span style={{color:'#fb7185'}}>{bookings.filter(b=>b.status==='Cancelled').length} cancelled</span></p>
              </div>
              <div style={{display:'flex',gap:8}}>
                <button className="btn-ghost btn-sm" onClick={async()=>{const r=await fetch('/api/setup-headers');const d=await r.json();showToast(r.ok?'success':'error',d.message||d.error)}}>Fix Headers</button>
                <button className="btn-ghost" onClick={exportCSV}><Download size={14}/>Export CSV</button>
              </div>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:18}}>
              {[{l:'Total',v:filteredBookings.length,c:'#93c5fd'},{l:'Confirmed',v:filteredBookings.filter(b=>b.status==='Confirmed').length,c:'#6ee7b7'},{l:'Cancelled',v:filteredBookings.filter(b=>b.status==='Cancelled').length,c:'#fb7185'},{l:'Hours',v:`${filteredBookings.filter(b=>b.status==='Confirmed').reduce((a,b)=>a+(Number(b.hours)||0),0).toFixed(1)}h`,c:'#60a5fa'}].map(s=>(
                <div key={s.l} className="glass-card" style={{padding:'12px',textAlign:'center'}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(100,116,139,0.65)',marginTop:4}}>{s.l}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',gap:10,marginBottom:16,flexWrap:'wrap'}}>
              <div style={{position:'relative',flex:1,minWidth:200}}>
                <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(100,116,139,0.6)'}}/>
                <input className="input-field" style={{paddingLeft:36}} placeholder="Search by rider, MB No, shift or date…" value={search} onChange={e=>{setSearch(e.target.value);setBookingPage(1);setRiderPage(1);setShiftPage(1)}}/>
              </div>
              <select className="input-field" style={{width:160}} value={bookingFilter} onChange={e=>setBookingFilter(e.target.value)}>
                <option value="">All Status</option><option value="Confirmed">Confirmed</option><option value="Cancelled">Cancelled</option>
              </select>
            </div>
            <div className="glass-card" style={{overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr><TH>Booking ID</TH><TH>Rider</TH><TH>City</TH><TH>Shift</TH><TH>Date</TH><TH>Start</TH><TH>End</TH><TH>Hours</TH><TH>Status</TH><TH>Cancel Reason</TH><TH>Created At</TH></tr></thead>
                  <tbody>
                    {filteredBookings.length===0&&<tr><td colSpan={11} style={{padding:'48px',textAlign:'center',color:'rgba(100,116,139,0.5)',fontSize:14}}>No bookings found</td></tr>}
                    {filteredBookings.slice((bookingPage-1)*PAGE_SIZE,bookingPage*PAGE_SIZE).map(b=>{
                      const r=riders.find(x=>x.nb===b.riderNb)
                      return (
                        <tr key={b.id} onMouseEnter={e=>(e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e=>(e.currentTarget.style.background='')} style={{transition:'background 0.12s'}}>
                          <TD><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(255,255,255,0.07)',padding:'2px 7px',borderRadius:6,color:'rgba(148,163,184,0.7)'}}>{b.id}</span></TD>
                          <TD>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <Avatar name={b.riderName||b.riderNb} size="sm"/>
                              <div>
                                <div style={{fontWeight:600,fontSize:13,color:'#e1e7f5'}}>{b.riderName||r?.name||b.riderNb}</div>
                                <span className="rider-tag" style={{fontSize:10}}>{b.riderNb}</span>
                              </div>
                            </div>
                          </TD>
                          <TD><CityBadge city={b.city}/></TD>
                          <TD><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'rgba(148,163,184,0.65)'}}>{b.shiftId||'—'}</span></TD>
                          <TD style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:'#e1e7f5',whiteSpace:'nowrap'}}>{b.shiftDate||'—'}</TD>
                          <TD style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:'#6ee7b7',whiteSpace:'nowrap'}}>{b.startTime||'—'}</TD>
                          <TD style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:'#6ee7b7',whiteSpace:'nowrap'}}>{b.endTime||'—'}</TD>
                          <TD><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:14,fontWeight:700,color:'#93c5fd'}}>{b.hours>0?`${b.hours}h`:'—'}</span></TD>
                          <TD><span className={`badge ${b.status==='Confirmed'?'badge-green':b.status==='Cancelled'?'badge-red':'badge-gray'}`}>{b.status}</span></TD>
                          <TD style={{fontSize:12,color:'rgba(100,116,139,0.65)',maxWidth:180,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{b.cancelReason||'—'}</TD>
                          <TD style={{fontSize:11,color:'rgba(100,116,139,0.5)',whiteSpace:'nowrap',fontFamily:"'JetBrains Mono',monospace"}}>{b.createdAt||'—'}</TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {filteredBookings.length>PAGE_SIZE&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',fontSize:12,color:'rgba(100,116,139,0.6)'}}>
              <span>Showing {Math.min((bookingPage-1)*PAGE_SIZE+1,filteredBookings.length)}–{Math.min(bookingPage*PAGE_SIZE,filteredBookings.length)} of {filteredBookings.length}</span>
              <div style={{display:'flex',gap:6}}>
                <button className="btn-ghost btn-xs" disabled={bookingPage===1} onClick={()=>setBookingPage(p=>p-1)}>← Prev</button>
                <span style={{padding:'4px 8px',fontSize:12}}>Page {bookingPage}/{Math.ceil(filteredBookings.length/PAGE_SIZE)}</span>
                <button className="btn-ghost btn-xs" disabled={bookingPage*PAGE_SIZE>=filteredBookings.length} onClick={()=>setBookingPage(p=>p+1)}>Next →</button>
              </div>
            </div>}
          </div>
        )}

        {/* ══ RIDERS ═══════════════════════════════════════ */}
        {page==='users' && (
          <div className="anim-fade">
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20,flexWrap:'wrap',gap:12}}>
              <div>
                <h1 className="page-title">Rider Management</h1>
                <p className="page-sub">You assign MB numbers · synced with Google Sheets · {filteredRiders.length} riders{cityFilter?` in ${cityFilter}`:''}</p>
              </div>
              <button className="btn-primary" onClick={()=>{setForm({city:cityFilter||''});setModal('addRider')}}><Plus size={15}/>Add Rider</button>
            </div>
            <div style={{position:'relative',marginBottom:16}}>
              <Search size={14} style={{position:'absolute',left:12,top:'50%',transform:'translateY(-50%)',color:'rgba(100,116,139,0.6)'}}/>
              <input className="input-field" style={{paddingLeft:36}} placeholder="Search by name or MB No…" value={search} onChange={e=>{setSearch(e.target.value);setRiderPage(1)}}/>
            </div>
            <div className="glass-card" style={{overflow:'hidden'}}>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead><tr><TH>Rider</TH><TH>MB No</TH><TH>City</TH><TH>Phone</TH><TH>Email</TH><TH>Weekly Hrs</TH><TH>Cancels</TH><TH>Status</TH><TH>Actions</TH></tr></thead>
                  <tbody>
                    {filteredRiders.slice((riderPage-1)*PAGE_SIZE,riderPage*PAGE_SIZE).map(r=>{
                      const pct=Math.min(r.weeklyHours/56*100,100)
                      const col=r.weeklyHours>=56?'#f43f5e':r.weeklyHours>=45?'#f59e0b':'#3b82f6'
                      return (
                        <tr key={r.nb} onMouseEnter={e=>(e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e=>(e.currentTarget.style.background='')} style={{transition:'background 0.12s'}}>
                          <TD>
                            <div style={{display:'flex',alignItems:'center',gap:10}}>
                              <Avatar name={r.name} size="md"/>
                              <div>
                                <div style={{fontWeight:600,fontSize:13.5,color:'#f1f5ff'}}>{r.name}</div>
                                <div style={{fontSize:11,color:'rgba(100,116,139,0.6)'}}>{r.email}</div>
                              </div>
                            </div>
                          </TD>
                          <TD><span className="rider-tag">{r.nb}</span></TD>
                          <TD><CityBadge city={r.city}/></TD>
                          <TD style={{fontSize:12,color:'rgba(148,163,184,0.7)'}}>{r.phone}</TD>
                          <TD style={{fontSize:12,color:'rgba(148,163,184,0.7)',maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.email}</TD>
                          <TD>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:13,fontWeight:700,color:col,minWidth:36}}>{r.weeklyHours}h</span>
                              <div className="progress-track" style={{width:72,height:5,margin:0}}><div className="progress-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,${col}90,${col})`}}/></div>
                            </div>
                          </TD>
                          <TD><span className={`badge ${r.cancellations>=5?'badge-red':r.cancellations>=3?'badge-amber':'badge-gray'}`}>{r.cancellations}/5</span></TD>
                          <TD><span className={`badge ${r.active?'badge-green':'badge-red'}`}>{r.active?'Active':'Inactive'}</span></TD>
                          <TD>
                            <div style={{display:'flex',gap:5}}>
                              <button className="btn-ghost btn-xs" onClick={()=>{setEditTarget(r);setForm({name:r.name,city:r.city,phone:r.phone,email:r.email});setModal('editRider')}}><Edit size={12}/></button>
                              <button className={`btn-xs ${r.active?'btn-danger':'btn-success'}`} onClick={()=>toggleRider(r.nb,!r.active)}>{r.active?<UserX size={12}/>:<UserCheck size={12}/>}</button>
                            </div>
                          </TD>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {filteredRiders.length>PAGE_SIZE&&<div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'12px 0',fontSize:12,color:'rgba(100,116,139,0.6)'}}>
              <span>Showing {Math.min((riderPage-1)*PAGE_SIZE+1,filteredRiders.length)}–{Math.min(riderPage*PAGE_SIZE,filteredRiders.length)} of {filteredRiders.length}</span>
              <div style={{display:'flex',gap:6}}>
                <button className="btn-ghost btn-xs" disabled={riderPage===1} onClick={()=>setRiderPage(p=>p-1)}>← Prev</button>
                <span style={{padding:'4px 8px'}}>Page {riderPage}/{Math.ceil(filteredRiders.length/PAGE_SIZE)}</span>
                <button className="btn-ghost btn-xs" disabled={riderPage*PAGE_SIZE>=filteredRiders.length} onClick={()=>setRiderPage(p=>p+1)}>Next →</button>
              </div>
            </div>}
          </div>
        )}

        {/* ══ HOURS ════════════════════════════════════════ */}
        {page==='hours' && (() => {
          const map: Record<string,{nb:string;name:string;city:string;confirmedHours:number;totalBookings:number;cancelledCount:number}>={}
          bookings.filter(b=>!cityFilter||b.city===cityFilter).forEach(b=>{
            if (!map[b.riderNb]) {
              const r=riders.find(x=>x.nb===b.riderNb)
              map[b.riderNb]={nb:b.riderNb,name:b.riderName||r?.name||b.riderNb,city:b.city||r?.city||'',confirmedHours:0,totalBookings:0,cancelledCount:0}
            }
            map[b.riderNb].totalBookings++
            if (b.status==='Confirmed') map[b.riderNb].confirmedHours+=(Number(b.hours)||0)
            else if (b.status==='Cancelled') map[b.riderNb].cancelledCount++
          })
          const list=Object.values(map).sort((a,b)=>b.confirmedHours-a.confirmedHours)
          const total=list.reduce((a,r)=>a+r.confirmedHours,0)
          return (
            <div className="anim-fade">
              <h1 className="page-title">Hours Booked Per Rider</h1>
              <p className="page-sub">From confirmed bookings · 56h/week limit{cityFilter?` · ${cityFilter}`:''}</p>
              <div className="stagger-children" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:22}}>
                <KpiCard label="Total Hours"    value={`${total.toFixed(1)}h`}  color="blue"   icon={Timer}/>
                <KpiCard label="Riders Tracked" value={list.length}             color="green"  icon={Users}/>
                <KpiCard label="Avg Hours"      value={`${list.length?+(total/list.length).toFixed(1):0}h`} color="violet" icon={TrendingUp}/>
                <KpiCard label="Near/At Limit"  value={list.filter(r=>r.confirmedHours>=45).length} color="amber" icon={AlertTriangle}/>
              </div>
              {list.filter(r=>r.confirmedHours>=45).length>0&&<div className="alert alert-warning" style={{marginBottom:18}}><AlertTriangle size={15} style={{flexShrink:0}}/><span><strong>{list.filter(r=>r.confirmedHours>=45).length}</strong> rider{list.filter(r=>r.confirmedHours>=45).length>1?'s':''} approaching or at the 56h limit.</span></div>}
              <div className="glass-card" style={{overflow:'hidden',marginBottom:16}}>
                <div style={{padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,0.05)',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:15,fontWeight:700,color:'#e1e7f5'}}>Hours Leaderboard</span>
                  <span style={{fontSize:11,color:'rgba(100,116,139,0.5)'}}>{list.length} riders</span>
                </div>
                <div style={{overflowX:'auto'}}>
                  <table style={{width:'100%',borderCollapse:'collapse'}}>
                    <thead><tr><TH>#</TH><TH>Rider</TH><TH>City</TH><TH>Hours</TH><TH>Progress</TH><TH>Shifts</TH><TH>Cancels</TH><TH>Status</TH></tr></thead>
                    <tbody>
                      {list.length===0&&<tr><td colSpan={8} style={{padding:'48px',textAlign:'center',color:'rgba(100,116,139,0.5)'}}>No booking data yet</td></tr>}
                      {list.map((r,i)=>{
                        const pct=Math.min(r.confirmedHours/56*100,100)
                        const col=r.confirmedHours>=56?'#f43f5e':r.confirmedHours>=45?'#f59e0b':r.confirmedHours>=30?'#3b82f6':'#10b981'
                        const rankCols=['rgba(251,191,36,0.25)','rgba(148,163,184,0.2)','rgba(180,83,9,0.2)']
                        return (
                          <tr key={r.nb} onMouseEnter={e=>(e.currentTarget.style.background='rgba(59,130,246,0.04)')} onMouseLeave={e=>(e.currentTarget.style.background='')} style={{transition:'background 0.12s'}}>
                            <TD><div style={{width:28,height:28,borderRadius:8,background:i<3?rankCols[i]:'rgba(255,255,255,0.04)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:i<3?['#fcd34d','#94a3b8','#d97706'][i]:'rgba(100,116,139,0.5)'}}>{i+1}</div></TD>
                            <TD>
                              <div style={{display:'flex',alignItems:'center',gap:10}}>
                                <Avatar name={r.name} size="sm"/>
                                <div><div style={{fontWeight:600,fontSize:13.5,color:'#f1f5ff'}}>{r.name}</div><span className="rider-tag" style={{fontSize:10}}>{r.nb}</span></div>
                              </div>
                            </TD>
                            <TD><CityBadge city={r.city}/></TD>
                            <TD><span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:22,fontWeight:700,color:col}}>{r.confirmedHours.toFixed(1)}</span><span style={{fontSize:12,color:'rgba(100,116,139,0.5)',marginLeft:3}}>/ 56h</span></TD>
                            <TD style={{minWidth:180}}>
                              <div style={{display:'flex',alignItems:'center',gap:8}}>
                                <div className="progress-track" style={{flex:1,height:6,margin:0}}><div className="progress-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,${col}80,${col})`,boxShadow:`0 0 8px ${col}50`}}/></div>
                                <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:11,color:'rgba(100,116,139,0.6)',minWidth:30}}>{Math.round(pct)}%</span>
                              </div>
                              <div style={{fontSize:11,color:'rgba(100,116,139,0.45)',marginTop:4}}>{Math.max(0,56-r.confirmedHours).toFixed(1)}h remaining</div>
                            </TD>
                            <TD style={{textAlign:'center'}}><span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:14,color:'#e1e7f5'}}>{r.totalBookings-r.cancelledCount}</span></TD>
                            <TD><span className={`badge ${r.cancelledCount>=5?'badge-red':r.cancelledCount>=3?'badge-amber':'badge-gray'}`}>{r.cancelledCount}/5</span></TD>
                            <TD>{r.confirmedHours>=56?<span className="badge badge-red" style={{display:'flex',alignItems:'center',gap:4}}><AlertTriangle size={10}/>Limit</span>:r.confirmedHours>=45?<span className="badge badge-amber" style={{display:'flex',alignItems:'center',gap:4}}><AlertTriangle size={10}/>Near</span>:<span className="badge badge-green">OK</span>}</TD>
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

      {/* ══ MODALS ════════════════════════════════════════ */}
      {modal==='addRider'&&(
        <Modal title="Add Rider" subtitle="You assign the MB No — rider uses it to log in" onClose={()=>setModal(null)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>MB No</label><input className="input-field" placeholder="e.g. MB010" value={form.nb||''} onChange={e=>setForm({...form,nb:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Full Name</label><input className="input-field" placeholder="First Last" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>City</label>
              <select className="input-field" value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}>
                <option value="">Select city…</option>
                {CITIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Phone</label><input className="input-field" placeholder="+49 176…" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
          </div>
          <div style={{marginBottom:20}}><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Email</label><input className="input-field" placeholder="rider@email.com" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button className="btn-primary" onClick={addRider}><Plus size={14}/>Add Rider</button></div>
        </Modal>
      )}

      {modal==='editRider'&&editTarget&&(
        <Modal title="Edit Rider" subtitle={`${editTarget.nb} · ${editTarget.name}`} onClose={()=>setModal(null)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Full Name</label><input className="input-field" value={form.name||''} onChange={e=>setForm({...form,name:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>City</label>
              <select className="input-field" value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}>
                <option value="">Select city…</option>
                {CITIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Phone</label><input className="input-field" value={form.phone||''} onChange={e=>setForm({...form,phone:e.target.value})}/></div>
          </div>
          <div style={{marginBottom:20}}><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Email</label><input className="input-field" value={form.email||''} onChange={e=>setForm({...form,email:e.target.value})}/></div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button className="btn-primary" onClick={saveEditRider}><CheckCircle size={14}/>Save Changes</button></div>
        </Modal>
      )}

      {modal==='addShift'&&(
        <Modal title="Create Shift" subtitle="Saved to Google Sheets — visible to riders immediately" onClose={()=>setModal(null)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>City</label>
              <select className="input-field" value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}>
                <option value="">Select city…</option>
                {CITIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Date</label><input type="date" className="input-field" value={form.date||''} onChange={e=>setForm({...form,date:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Start Time</label><input type="time" className="input-field" value={form.start||'09:00'} onChange={e=>setForm({...form,start:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>End Time</label><input type="time" className="input-field" value={form.end||'14:00'} onChange={e=>setForm({...form,end:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Rider Slots</label><input type="number" className="input-field" min="1" max="50" value={form.capacity||5} onChange={e=>setForm({...form,capacity:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Notes / Route</label><input className="input-field" placeholder="e.g. City centre" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button className="btn-primary" onClick={addShift}><Plus size={14}/>Create Shift</button></div>
        </Modal>
      )}

      {modal==='editShift'&&editTarget&&(
        <Modal title="Edit Shift" subtitle={`${editTarget.id} · ${editTarget.date}`} onClose={()=>setModal(null)}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:14}}>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>City</label>
              <select className="input-field" value={form.city||''} onChange={e=>setForm({...form,city:e.target.value})}>
                <option value="">Select city…</option>
                {CITIES.map(c=><option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Capacity</label><input type="number" className="input-field" min="1" value={form.capacity||''} onChange={e=>setForm({...form,capacity:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Start Time</label><input type="time" className="input-field" value={form.start||''} onChange={e=>setForm({...form,start:e.target.value})}/></div>
            <div><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>End Time</label><input type="time" className="input-field" value={form.end||''} onChange={e=>setForm({...form,end:e.target.value})}/></div>
            <div style={{gridColumn:'1/-1'}}><label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>Notes</label><input className="input-field" value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})}/></div>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}><button className="btn-ghost" onClick={()=>setModal(null)}>Cancel</button><button className="btn-primary" onClick={saveEditShift}><CheckCircle size={14}/>Save Changes</button></div>
        </Modal>
      )}
    </>
  )
}

