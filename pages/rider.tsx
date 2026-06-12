import { useState, useEffect, useCallback } from 'react'
import Head from 'next/head'
import {
  CalendarDays, ClipboardList, Clock, Bell, LogOut, Zap,
  CheckCircle, XCircle, AlertTriangle, ArrowRight, Timer,
  Users, Flame, MapPin, ChevronRight, Building2, Globe,
} from 'lucide-react'
import { Spinner, Toast, Modal, ProgressRing, EmptyState, Avatar, Skeleton } from '../components/ui'
import Layout from '../components/Layout'

// ── CITIES ───────────────────────────────────────────────────
const CITIES = ['Berlin', 'Munich', 'Frankfurt', 'Stuttgart'] as const
type City = typeof CITIES[number]

// ── TRANSLATIONS ─────────────────────────────────────────────
type Lang = 'en' | 'ar' | 'de'
const LANGS: Record<Lang, string> = { en: 'English', ar: 'العربية', de: 'Deutsch' }

const T: Record<Lang, Record<string, string>> = {
  en: {
    appName:        'FleetOps',
    portalLabel:    'Rider Portal',
    welcomeBack:    'Welcome back',
    signInSub:      'Sign in with your MB No and registered contact',
    mbNo:           'MB No',
    mbPlaceholder:  'e.g. MB10',
    emailPhone:     'Email or Phone',
    emailPlaceholder:'your@email.com or +49...',
    signIn:         'Sign In',
    signingIn:      'Signing in...',
    contactAdmin:   'Contact your admin if you need your MB No',
    selectCity:     'Select Your City',
    selectCitySub:  'Choose your assigned city to see available shifts',
    continue:       'Continue',
    availShifts:    'Available Shifts',
    availSub:       'Shifts for',
    selectDate:     'Select a date and book your shift',
    myBookings:     'My Bookings',
    bookingHistory: 'Your complete booking history',
    upcoming:       'Upcoming Shifts',
    upcomingSub:    'Your confirmed future schedule',
    notifications:  'Notifications',
    notifSub:       'Reminders, alerts and weekly status',
    today:          'Today',
    noShifts:       'No shifts available',
    noShiftsSub:    'No shifts scheduled in',
    noShiftsSub2:   'for this date.',
    book:           'Book This Shift',
    booking:        'Booking...',
    booked:         'Booked!',
    cancel:         'Cancel Booking',
    full:           'Full',
    open:           'Open',
    limit:          'Limit',
    fillingFast:    'Filling fast',
    weeklyHours:    'Weekly Hours',
    todayHours:     "Today's Hours",
    remaining:      'remaining',
    confirmed:      'Confirmed',
    cancelled:      'Cancelled',
    thisWeek:       'This Week',
    noBookings:     'No bookings yet',
    noBookingsSub:  'Book your first shift from Available Shifts.',
    noUpcoming:     'No upcoming shifts',
    noUpcomingSub:  'Book a shift to see it here.',
    cancelBooking:  'Cancel Booking',
    cancelSub:      'Recorded and counts toward your weekly limit',
    reason:         'Reason for cancellation',
    selectReason:   'Select a reason...',
    keepBooking:    'Keep Booking',
    confirmCancel:  'Confirm Cancel',
    personalEmerg:  'Personal emergency',
    vehicleIssue:   'Vehicle issue',
    medicalAppt:    'Medical appointment',
    familyMatter:   'Family matter',
    workConflict:   'Work conflict',
    other:          'Other',
    weeklyStatus:   'Weekly Hours Status',
    logout:         'Logout',
    syncing:        'Syncing',
    syncedAt:       'Synced',
    slots:          'slots',
    shift:          'shift',
    riders:         'riders',
    changeCity:     'Change City',
  },
  ar: {
    appName:        'FleetOps',
    portalLabel:    'بوابة السائق',
    welcomeBack:    'مرحباً بعودتك',
    signInSub:      'سجّل الدخول برقم MB وبيانات الاتصال المسجّلة',
    mbNo:           'رقم MB',
    mbPlaceholder:  'مثال: MB10',
    emailPhone:     'البريد الإلكتروني أو الهاتف',
    emailPlaceholder:'بريدك@example.com أو +49...',
    signIn:         'تسجيل الدخول',
    signingIn:      'جارٍ التسجيل...',
    contactAdmin:   'تواصل مع المشرف للحصول على رقم MB',
    selectCity:     'اختر مدينتك',
    selectCitySub:  'اختر المدينة المخصصة لك لعرض الوردیات',
    continue:       'متابعة',
    availShifts:    'الوردیات المتاحة',
    availSub:       'وردیات في',
    selectDate:     'اختر تاريخاً واحجز ورديتك',
    myBookings:     'حجوزاتي',
    bookingHistory: 'سجل حجوزاتك الكامل',
    upcoming:       'الوردیات القادمة',
    upcomingSub:    'جدولك المؤكد للمستقبل',
    notifications:  'الإشعارات',
    notifSub:       'تذكيرات وتنبيهات وحالة الأسبوع',
    today:          'اليوم',
    noShifts:       'لا توجد وردیات',
    noShiftsSub:    'لا توجد وردیات في',
    noShiftsSub2:   'لهذا التاريخ.',
    book:           'احجز هذه الوردية',
    booking:        'جارٍ الحجز...',
    booked:         'تم الحجز!',
    cancel:         'إلغاء الحجز',
    full:           'مكتمل',
    open:           'متاح',
    limit:          'الحد الأقصى',
    fillingFast:    'يمتلئ بسرعة',
    weeklyHours:    'ساعات الأسبوع',
    todayHours:     'ساعات اليوم',
    remaining:      'متبقية',
    confirmed:      'مؤكد',
    cancelled:      'ملغي',
    thisWeek:       'هذا الأسبوع',
    noBookings:     'لا توجد حجوزات بعد',
    noBookingsSub:  'احجز ورديتك الأولى من الوردیات المتاحة.',
    noUpcoming:     'لا توجد وردیات قادمة',
    noUpcomingSub:  'احجز وردية لتراها هنا.',
    cancelBooking:  'إلغاء الحجز',
    cancelSub:      'يُسجَّل ويُحتسب ضمن حد الإلغاء الأسبوعي',
    reason:         'سبب الإلغاء',
    selectReason:   'اختر سبباً...',
    keepBooking:    'الاحتفاظ بالحجز',
    confirmCancel:  'تأكيد الإلغاء',
    personalEmerg:  'طارئ شخصي',
    vehicleIssue:   'مشكلة في المركبة',
    medicalAppt:    'موعد طبي',
    familyMatter:   'أمر عائلي',
    workConflict:   'تعارض في العمل',
    other:          'أخرى',
    weeklyStatus:   'حالة ساعات الأسبوع',
    logout:         'تسجيل الخروج',
    syncing:        'مزامنة',
    syncedAt:       'تزامن',
    slots:          'مقعد',
    shift:          'ورديـة',
    riders:         'سائقين',
    changeCity:     'تغيير المدينة',
  },
  de: {
    appName:        'FleetOps',
    portalLabel:    'Fahrer-Portal',
    welcomeBack:    'Willkommen zurück',
    signInSub:      'Melde dich mit deiner MB-Nummer an',
    mbNo:           'MB-Nummer',
    mbPlaceholder:  'z.B. MB10',
    emailPhone:     'E-Mail oder Telefon',
    emailPlaceholder:'deine@email.com oder +49...',
    signIn:         'Anmelden',
    signingIn:      'Wird angemeldet...',
    contactAdmin:   'Kontaktiere deinen Admin für deine MB-Nummer',
    selectCity:     'Stadt auswählen',
    selectCitySub:  'Wähle deine Stadt, um verfügbare Schichten zu sehen',
    continue:       'Weiter',
    availShifts:    'Verfügbare Schichten',
    availSub:       'Schichten in',
    selectDate:     'Datum wählen und Schicht buchen',
    myBookings:     'Meine Buchungen',
    bookingHistory: 'Deine Buchungsübersicht',
    upcoming:       'Kommende Schichten',
    upcomingSub:    'Dein bestätigter Zeitplan',
    notifications:  'Benachrichtigungen',
    notifSub:       'Erinnerungen und Wochenstatus',
    today:          'Heute',
    noShifts:       'Keine Schichten verfügbar',
    noShiftsSub:    'Keine Schichten geplant in',
    noShiftsSub2:   'für dieses Datum.',
    book:           'Schicht buchen',
    booking:        'Wird gebucht...',
    booked:         'Gebucht!',
    cancel:         'Buchung stornieren',
    full:           'Voll',
    open:           'Offen',
    limit:          'Limit',
    fillingFast:    'Schnell belegt',
    weeklyHours:    'Wochenstunden',
    todayHours:     'Heutige Stunden',
    remaining:      'verbleibend',
    confirmed:      'Bestätigt',
    cancelled:      'Storniert',
    thisWeek:       'Diese Woche',
    noBookings:     'Noch keine Buchungen',
    noBookingsSub:  'Buche deine erste Schicht.',
    noUpcoming:     'Keine kommenden Schichten',
    noUpcomingSub:  'Buche eine Schicht, um sie hier zu sehen.',
    cancelBooking:  'Buchung stornieren',
    cancelSub:      'Wird gespeichert und zählt zum Wochenlimit',
    reason:         'Stornierungsgrund',
    selectReason:   'Grund auswählen...',
    keepBooking:    'Buchung behalten',
    confirmCancel:  'Stornierung bestätigen',
    personalEmerg:  'Persönlicher Notfall',
    vehicleIssue:   'Fahrzeugproblem',
    medicalAppt:    'Arzttermin',
    familyMatter:   'Familienangelegenheit',
    workConflict:   'Terminkonflikt',
    other:          'Sonstiges',
    weeklyStatus:   'Wochenstunden-Status',
    logout:         'Abmelden',
    syncing:        'Synchronisiere',
    syncedAt:       'Synchronisiert',
    slots:          'Plätze',
    shift:          'Schicht',
    riders:         'Fahrer',
    changeCity:     'Stadt wechseln',
  },
}

// ── CONSTANTS ──────────────────────────────────────────────
const DAYS_EN   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const DAYS_DE   = ['So','Mo','Di','Mi','Do','Fr','Sa']
const DAYS_AR   = ['أحد','اثن','ثلا','أرب','خمس','جمع','سبت']
const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTHS_DE = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez']
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

const WEEKLY_LIMIT = 56
const DAILY_LIMIT  = 8

const CITY_COLORS: Record<string,{bg:string;text:string;border:string}> = {
  Berlin:    { bg:'rgba(59,130,246,0.15)',  text:'#93c5fd', border:'rgba(59,130,246,0.3)' },
  Munich:    { bg:'rgba(16,185,129,0.15)',  text:'#6ee7b7', border:'rgba(16,185,129,0.3)' },
  Frankfurt: { bg:'rgba(245,158,11,0.15)',  text:'#fcd34d', border:'rgba(245,158,11,0.3)' },
  Stuttgart: { bg:'rgba(167,139,250,0.15)', text:'#c4b5fd', border:'rgba(167,139,250,0.3)' },
}
function cityStyle(city: string) {
  return CITY_COLORS[city] || { bg:'rgba(148,163,184,0.1)', text:'#94a3b8', border:'rgba(148,163,184,0.2)' }
}

function getWeekMonday() {
  const d = new Date()
  d.setDate(d.getDate() - ((d.getDay()+6)%7))
  d.setHours(0,0,0,0)
  return d
}
function localDateISO(d=new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}
function fmt12(t:string) {
  if (!t||t==='00:00') return ''
  const [h,m] = t.split(':').map(Number)
  if (isNaN(h)) return t
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`
}
function fmtDateISO(d:string, lang:Lang='en') {
  if (!d) return ''
  const dt = new Date(d+'T00:00:00')
  if (isNaN(dt.getTime())) return d
  const days   = lang==='ar' ? DAYS_AR   : lang==='de' ? DAYS_DE   : DAYS_EN
  const months = lang==='ar' ? MONTHS_AR : lang==='de' ? MONTHS_DE : MONTHS_EN
  return `${days[dt.getDay()]} ${dt.getDate()} ${months[dt.getMonth()]}`
}
function toISO(raw:string) {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0,10)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) { const [d,m,y]=raw.split('.'); return `${y}-${m}-${d}` }
  return raw
}

type Rider   = { nb:string; name:string; city:string; email:string; phone:string }
type Shift   = { id:string; city:string; date:string; day:string; start:string; end:string; hours:number; capacity:number; booked:number; status:string; notes:string }
type Booking = { id:string; riderNb:string; riderName:string; city:string; shiftId:string; shiftDate:string; day:string; startTime:string; endTime:string; hours:number; status:string; cancelReason:string; createdAt:string; updatedAt:string }

export default function RiderPortal() {
  const [lang,         setLang]        = useState<Lang>('en')
  const t = (k: string) => T[lang][k] || T['en'][k] || k

  const [rider,        setRider]       = useState<Rider|null>(null)
  const [selectedCity, setSelectedCity]= useState<string>('')  // city chosen in portal
  const [cityChosen,   setCityChosen]  = useState(false)       // show city picker
  const [page,         setPage]        = useState<'shifts'|'mybookings'|'upcoming'|'notifications'>('shifts')
  const [shifts,       setShifts]      = useState<Shift[]>([])
  const [bookings,     setBookings]    = useState<Booking[]>([])
  const [selectedDate, setSelectedDate]= useState(localDateISO)
  const [loading,      setLoading]     = useState(false)
  const [syncing,      setSyncing]     = useState(false)
  const [lastSync,     setLastSync]    = useState<Date|null>(null)
  const [toast,        setToast]       = useState<{type:any;message:string}|null>(null)
  const [cancelModal,  setCancelModal] = useState<{bookingId:string;reason:string}|null>(null)
  const [nb,           setNb]          = useState('')
  const [contact,      setContact]     = useState('')
  const [loginErr,     setLoginErr]    = useState('')
  const [loginLoading, setLoginLoading]= useState(false)
  const [successId,    setSuccessId]   = useState<string|null>(null)

  const showToast = (type:any, message:string) => setToast({type,message})

  // Active city: from sheet if set, otherwise from portal selection
  const activeCity = rider?.city || selectedCity

  const loadData = useCallback(async (silent=false) => {
    if (!rider) return
    if (!silent) setLoading(true); else setSyncing(true)
    try {
      const [sRes,bRes] = await Promise.all([fetch('/api/shifts'),fetch('/api/bookings')])
      if (sRes.ok) { const d=await sRes.json(); setShifts(Array.isArray(d)?d:[]) }
      else { console.error('shifts API error'); showToast('error','Failed to load shifts. Retrying shortly.') }
      if (bRes.ok) { const d=await bRes.json(); setBookings(Array.isArray(d)?d:[]) }
      else { console.error('bookings API error') }
      setLastSync(new Date())
    } catch { if (!silent) showToast('error','Network error. Check connection.') }
    finally { setLoading(false); setSyncing(false) }
  }, [rider])

  useEffect(() => {
    if (!rider) return
    loadData()
    const interval = setInterval(() => loadData(true), 30000)
    return () => clearInterval(interval)
  }, [rider, loadData])

  async function login() {
    setLoginLoading(true); setLoginErr('')
    try {
      const res  = await fetch('/api/auth/rider-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({nb,contact})})
      const data = await res.json()
      if (!res.ok) { setLoginErr(data.error||'Login failed'); return }
      const riderData = data.rider
      setRider(riderData)
      // If rider has no city in sheet, show city picker
      if (!riderData.city) { setCityChosen(false) }
      else { setCityChosen(true) }
    } catch { setLoginErr('Network error. Please try again.') }
    finally { setLoginLoading(false) }
  }

  async function logout() {
    await fetch('/api/auth/logout',{method:'POST'})
    setRider(null); setShifts([]); setBookings([])
    setSelectedCity(''); setCityChosen(false)
  }

  async function bookShift(shiftId:string) {
    setLoading(true)
    try {
      const res  = await fetch('/api/bookings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({shiftId})})
      const data = await res.json()
      if (!res.ok) { showToast('error',data.error); return }
      setSuccessId(shiftId); setTimeout(()=>setSuccessId(null),3500)
      showToast('success',`${t('booked')} ${data.weeklyRemaining}h ${t('remaining')}`)
      await loadData(true)
    } finally { setLoading(false) }
  }

  async function cancelBooking() {
    if (!cancelModal?.reason) { showToast('warning', t('selectReason')); return }
    setLoading(true)
    try {
      const res  = await fetch('/api/bookings',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({bookingId:cancelModal.bookingId,reason:cancelModal.reason})})
      const data = await res.json()
      if (!res.ok) { showToast('error',data.error); return }
      showToast('success', t('cancelled'))
      setCancelModal(null); await loadData(true)
    } finally { setLoading(false) }
  }

  const days   = lang==='ar' ? DAYS_AR   : lang==='de' ? DAYS_DE   : DAYS_EN
  const months = lang==='ar' ? MONTHS_AR : lang==='de' ? MONTHS_DE : MONTHS_EN
  const isRTL  = lang === 'ar'

  const myBookings   = bookings.filter(b => b.riderNb===rider?.nb)
  const myConfirmed  = myBookings.filter(b => b.status==='Confirmed')
  const myCancelled  = myBookings.filter(b => b.status==='Cancelled')
  const bookedIds    = new Set(myConfirmed.map(b => b.shiftId))
  const monday       = getWeekMonday()
  const sunday       = new Date(monday); sunday.setDate(monday.getDate()+6)

  const weeklyCancels = myCancelled.filter(b => {
    const iso=toISO(b.shiftDate); if (!iso) return false
    const d=new Date(iso+'T00:00:00'); return d>=monday&&d<=sunday
  }).length

  const weeklyHours = parseFloat(
    myConfirmed.filter(b => {
      const s=shifts.find(x=>x.id===b.shiftId)
      const iso=b.shiftDate?toISO(b.shiftDate):(s?toISO(s.date):'')
      if (!iso) return false
      const d=new Date(iso+'T00:00:00'); return d>=monday&&d<=sunday
    }).reduce((a,b) => { const s=shifts.find(x=>x.id===b.shiftId); return a+(Number(b.hours)||Number(s?.hours)||0) }, 0).toFixed(1)
  )

  const dailyShifts = myConfirmed.filter(b => {
    const s=shifts.find(x=>x.id===b.shiftId)
    const iso=b.shiftDate?toISO(b.shiftDate):(s?toISO(s.date):'')
    return iso===selectedDate
  })
  const dailyHours = parseFloat(
    dailyShifts.reduce((a,b) => { const s=shifts.find(x=>x.id===b.shiftId); return a+(Number(b.hours)||Number(s?.hours)||0) }, 0).toFixed(1)
  )

  // City-filtered shifts
  const cityShifts = activeCity ? shifts.filter(s => !s.city || s.city===activeCity) : shifts
  const dayShifts  = cityShifts.filter(s => s.date===selectedDate)

  // Next 30 days
  const next30 = Array.from({length:30},(_,i)=>{ const d=new Date(); d.setDate(d.getDate()+i); return d })
  const cs = cityStyle(activeCity)

  // ── LANGUAGE BAR ─────────────────────────────────────────
  const LangBar = () => (
    <div style={{display:'flex',gap:4,alignItems:'center'}}>
      <Globe size={13} color="rgba(100,116,139,0.6)"/>
      {(Object.keys(LANGS) as Lang[]).map(l => (
        <button key={l} onClick={()=>setLang(l)}
          style={{fontSize:11,fontWeight:lang===l?700:500,padding:'2px 7px',borderRadius:8,cursor:'pointer',border:'1px solid',
            background:lang===l?'rgba(59,130,246,0.2)':'transparent',
            color:lang===l?'#93c5fd':'rgba(100,116,139,0.6)',
            borderColor:lang===l?'rgba(59,130,246,0.35)':'transparent'}}>
          {l==='ar'?'عر':l==='de'?'DE':'EN'}
        </button>
      ))}
    </div>
  )

  // ── LOGIN ─────────────────────────────────────────────────
  if (!rider) {
    return (
      <>
        <Head><title>FleetOps — {t('portalLabel')}</title></Head>
        <div className="app-bg" aria-hidden><div className="app-grid"/><div className="app-scanline"/></div>
        {toast&&<Toast type={toast.type} message={toast.message} onClose={()=>setToast(null)}/>}
        <div className="login-wrap">
          <div className="login-card anim-up" dir={isRTL?'rtl':'ltr'}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20}}>
              <div style={{display:'flex',alignItems:'center',gap:12}}>
                <div className="logo-icon" style={{width:40,height:40,borderRadius:12}}><Zap size={19} color="#fff" fill="#fff"/></div>
                <div>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,fontSize:16,color:'#f1f5ff'}}>{t('appName')}</div>
                  <div style={{fontSize:10,color:'#60a5fa',fontWeight:600,letterSpacing:'0.1em',textTransform:'uppercase'}}>{t('portalLabel')}</div>
                </div>
              </div>
              <LangBar/>
            </div>

            <h1 style={{fontSize:24,fontWeight:800,color:'#f1f5ff',letterSpacing:'-0.5px',marginBottom:4}}>{t('welcomeBack')}</h1>
            <p style={{fontSize:13,color:'rgba(100,116,139,0.85)',marginBottom:24}}>{t('signInSub')}</p>

            {loginErr && <div className="alert alert-danger" style={{marginBottom:16}}><XCircle size={15} style={{flexShrink:0}}/> {loginErr}</div>}

            <div style={{marginBottom:14}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>{t('mbNo')}</label>
              <input className="input-field" placeholder={t('mbPlaceholder')} value={nb} onChange={e=>setNb(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} dir="ltr"/>
            </div>
            <div style={{marginBottom:22}}>
              <label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:7}}>{t('emailPhone')}</label>
              <input className="input-field" placeholder={t('emailPlaceholder')} value={contact} onChange={e=>setContact(e.target.value)} onKeyDown={e=>e.key==='Enter'&&login()} dir="ltr"/>
            </div>

            <button className="btn-primary" style={{width:'100%',justifyContent:'center',padding:'12px',borderRadius:14,fontSize:15}} onClick={login} disabled={loginLoading}>
              {loginLoading ? <><Spinner size={16}/>{t('signingIn')}</> : <>{t('signIn')} <ArrowRight size={16}/></>}
            </button>
            <p style={{textAlign:'center',fontSize:12,color:'rgba(100,116,139,0.5)',marginTop:18}}>{t('contactAdmin')}</p>
          </div>
        </div>
      </>
    )
  }

  // ── CITY SELECTOR (shown after login if rider has no city in sheet) ──
  if (!cityChosen || !activeCity) {
    return (
      <>
        <Head><title>FleetOps — {t('selectCity')}</title></Head>
        <div className="app-bg" aria-hidden><div className="app-grid"/><div className="app-scanline"/></div>
        {toast&&<Toast type={toast.type} message={toast.message} onClose={()=>setToast(null)}/>}
        <div className="login-wrap">
          <div className="login-card anim-up" style={{maxWidth:480}} dir={isRTL?'rtl':'ltr'}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:24}}>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <Avatar name={rider.name} size="md"/>
                <div>
                  <div style={{fontWeight:700,fontSize:15,color:'#f1f5ff'}}>{rider.name}</div>
                  <span className="rider-tag" style={{fontSize:10}}>{rider.nb}</span>
                </div>
              </div>
              <LangBar/>
            </div>

            <h2 style={{fontSize:22,fontWeight:800,color:'#f1f5ff',marginBottom:6}}>{t('selectCity')}</h2>
            <p style={{fontSize:13,color:'rgba(100,116,139,0.8)',marginBottom:24}}>{t('selectCitySub')}</p>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:24}}>
              {CITIES.map(city => {
                const cst = cityStyle(city)
                const sel = selectedCity===city
                return (
                  <button key={city} onClick={()=>setSelectedCity(city)}
                    style={{padding:'20px 16px',borderRadius:16,cursor:'pointer',textAlign:'center',
                      background:sel?cst.bg:'rgba(255,255,255,0.04)',
                      border:`2px solid ${sel?cst.border:'rgba(255,255,255,0.07)'}`,
                      boxShadow:sel?`0 0 20px ${cst.border}40`:'none',
                      transition:'all 0.15s'}}>
                    <Building2 size={24} color={sel?cst.text:'rgba(100,116,139,0.5)'} style={{margin:'0 auto 8px'}}/>
                    <div style={{fontWeight:700,fontSize:15,color:sel?cst.text:'rgba(203,213,225,0.8)'}}>{city}</div>
                    {sel && <div style={{marginTop:6,width:8,height:8,borderRadius:'50%',background:cst.text,margin:'6px auto 0'}}/>}
                  </button>
                )
              })}
            </div>

            <button
              className="btn-primary"
              style={{width:'100%',justifyContent:'center',padding:'12px',borderRadius:14,fontSize:15,opacity:selectedCity?1:0.4}}
              onClick={()=>{ if(selectedCity) setCityChosen(true) }}
              disabled={!selectedCity}>
              {t('continue')} <ChevronRight size={16}/>
            </button>
          </div>
        </div>
      </>
    )
  }

  // ── MAIN PORTAL ────────────────────────────────────────────
  const navItems = [
    {id:'shifts',        label:t('availShifts'), icon:CalendarDays},
    {id:'mybookings',    label:t('myBookings'),  icon:ClipboardList},
    {id:'upcoming',      label:t('upcoming'),    icon:Clock},
    {id:'notifications', label:t('notifications'),icon:Bell, badge:weeklyCancels>0?weeklyCancels:undefined},
  ]

  const sidebarTop = (
    <div style={{padding:'8px 6px 10px',display:'flex',alignItems:'center',gap:10}}>
      <Avatar name={rider.name} size="sm"/>
      <div style={{minWidth:0}}>
        <div style={{fontWeight:600,fontSize:13,color:'#e1e7f5',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{rider.name}</div>
        <div style={{display:'flex',alignItems:'center',gap:5,marginTop:3,flexWrap:'wrap'}}>
          <span className="rider-tag" style={{fontSize:10}}>{rider.nb}</span>
          <span style={{fontSize:10,fontWeight:600,padding:'1px 6px',borderRadius:5,background:cs.bg,color:cs.text,border:`1px solid ${cs.border}`}}>
            {activeCity}
          </span>
        </div>
      </div>
    </div>
  )

  const sidebarBottom = (
    <div>
      <div style={{padding:'4px 10px 6px'}}><LangBar/></div>
      {/* Change city button */}
      {!rider.city && (
        <button className="nav-item" style={{color:'rgba(34,211,238,0.7)'}} onClick={()=>setCityChosen(false)}>
          <Building2 size={15}/><span>{t('changeCity')}</span>
        </button>
      )}
      <button className="nav-item" style={{color:'rgba(251,113,133,0.8)'}} onClick={logout}>
        <LogOut size={15}/><span>{t('logout')}</span>
      </button>
    </div>
  )

  const topbarRight = (
    <div style={{display:'flex',alignItems:'center',gap:12}} dir="ltr">
      {syncing
        ? <span style={{fontSize:12,color:'rgba(100,116,139,0.6)',display:'flex',alignItems:'center',gap:6}}><Spinner size={12}/>{t('syncing')}</span>
        : lastSync && <span style={{fontSize:11,color:'rgba(100,116,139,0.45)'}}>{t('syncedAt')} {lastSync.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</span>
      }
      <span style={{fontSize:12,fontWeight:600,padding:'3px 10px',borderRadius:20,background:cs.bg,color:cs.text,border:`1px solid ${cs.border}`,display:'flex',alignItems:'center',gap:5}}>
        <Building2 size={12}/>{activeCity}
      </span>
      <ProgressRing value={weeklyHours} max={WEEKLY_LIMIT} size={32} strokeWidth={3}
        color={weeklyHours>=50?'#f43f5e':weeklyHours>=40?'#f59e0b':'#10b981'}/>
      <span style={{fontSize:12,fontWeight:700,fontFamily:"'JetBrains Mono',monospace",color:'#e1e7f5'}}>{weeklyHours}<span style={{color:'rgba(100,116,139,0.6)',fontWeight:400}}>/{WEEKLY_LIMIT}h</span></span>
    </div>
  )

  return (
    <>
      <Head><title>FleetOps — {rider.name}</title></Head>
      {toast&&<Toast type={toast.type} message={toast.message} onClose={()=>setToast(null)}/>}

      <Layout navItems={navItems} activePage={page} onNav={p=>setPage(p as any)}
        topbarRight={topbarRight} sidebarTop={sidebarTop} sidebarBottom={sidebarBottom}
        portalLabel={t('portalLabel')} portalColor="#60a5fa">

        {/* ══ AVAILABLE SHIFTS ══ */}
        {page==='shifts' && (
          <div className="anim-fade" dir={isRTL?'rtl':'ltr'}>
            <div style={{marginBottom:20}}>
              <h1 className="page-title">{t('availShifts')}</h1>
              <p className="page-sub">{t('availSub')} <strong style={{color:cs.text}}>{activeCity}</strong></p>
            </div>

            {/* Hours meters */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:22}}>
              {[
                {label:t('weeklyHours'), val:weeklyHours, max:WEEKLY_LIMIT},
                {label:t('todayHours'),  val:dailyHours,  max:DAILY_LIMIT},
              ].map(m => {
                const pct=Math.min(m.val/m.max*100,100)
                const col=m.val>=m.max?'#f43f5e':m.val>=m.max*0.8?'#f59e0b':'#10b981'
                return (
                  <div key={m.label} className="glass-card" style={{padding:'14px 16px'}}>
                    <div style={{display:'flex',justifyContent:'space-between',marginBottom:10}}>
                      <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',color:'rgba(100,116,139,0.8)'}}>{m.label}</span>
                      <span style={{fontFamily:"'JetBrains Mono',monospace",fontSize:12,fontWeight:700,color:col}}>{m.val}/{m.max}h</span>
                    </div>
                    <div className="progress-track"><div className="progress-fill" style={{width:`${pct}%`,background:`linear-gradient(90deg,${col}bb,${col})`}}/></div>
                    <div style={{fontSize:11,color:'rgba(100,116,139,0.6)',marginTop:7}}>{Math.max(0,m.max-m.val).toFixed(1)}h {t('remaining')}</div>
                  </div>
                )
              })}
            </div>

            {/* Date tabs — 30 days */}
            <div className="date-tabs" style={{marginBottom:22}}>
              {next30.map((d,i) => {
                const dk = localDateISO(d)
                const active = selectedDate===dk
                const hasShifts = cityShifts.some(s=>s.date===dk)
                const showMonth = d.getDate()===1 || i===0
                return (
                  <button key={dk} onClick={()=>setSelectedDate(dk)} className={`date-tab ${active?'active':''}`}>
                    {showMonth && (
                      <div style={{fontSize:9,fontWeight:700,letterSpacing:'0.04em',color:active?'#60a5fa':'rgba(100,116,139,0.4)',marginBottom:1,textTransform:'uppercase'}}>
                        {months[d.getMonth()]}
                      </div>
                    )}
                    <div className="date-tab-day">{i===0?t('today'):days[d.getDay()]}</div>
                    <div className="date-tab-num">{d.getDate()}</div>
                    {hasShifts && <div style={{width:5,height:5,borderRadius:'50%',background:active?'#60a5fa':'rgba(100,116,139,0.4)',margin:'3px auto 0'}}/>}
                  </button>
                )
              })}
            </div>

            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
              <h2 style={{fontSize:15,fontWeight:700,color:'#e1e7f5'}}>{fmtDateISO(selectedDate,lang)}</h2>
              <span style={{fontSize:12,color:'rgba(100,116,139,0.6)'}}>{dayShifts.length} {t('shift')}{dayShifts.length!==1&&lang==='en'?'s':''}</span>
            </div>

            {loading && <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:14}}>{[1,2,3,4].map(i=><Skeleton key={i} style={{height:220}}/>)}</div>}
            {!loading && dayShifts.length===0 && (
              <EmptyState icon={CalendarDays} title={t('noShifts')} description={`${t('noShiftsSub')} ${activeCity} ${t('noShiftsSub2')}`}/>
            )}

            {!loading && dayShifts.length>0 && (
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(270px,1fr))',gap:14}}>
                {dayShifts.map(s => {
                  const pct       = s.capacity>0?Math.round(s.booked/s.capacity*100):0
                  const fillClass = pct>=100?'cap-high':pct>=70?'cap-mid':'cap-low'
                  const isBooked  = bookedIds.has(s.id)
                  const isFull    = s.booked>=s.capacity
                  const myBk      = myConfirmed.find(b=>b.shiftId===s.id)
                  const excD      = !isBooked && dailyHours+Number(s.hours)>DAILY_LIMIT
                  const excW      = !isBooked && weeklyHours+Number(s.hours)>WEEKLY_LIMIT
                  const blocked   = excD||excW
                  const isSuccess = successId===s.id
                  return (
                    <div key={s.id} className={`shift-card ${isBooked?'shift-booked':''} ${isFull&&!isBooked?'shift-full':''}`}
                      style={isSuccess?{borderColor:'rgba(16,185,129,0.4)',boxShadow:'0 0 24px rgba(16,185,129,0.15)'}:{}}>
                      <div style={{height:2,background:isBooked?'linear-gradient(90deg,#2563eb,transparent)':isFull?'rgba(255,255,255,0.07)':'linear-gradient(90deg,#059669,transparent)'}}/>
                      <div style={{padding:'16px 18px'}}>
                        {/* Shift ID */}
                        <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:10,color:'rgba(100,116,139,0.5)',marginBottom:6}}>{s.id}</div>
                        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
                          <div>
                            <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:17,fontWeight:700,color:'#f1f5ff',marginBottom:3}}>
                              {fmt12(s.start)} – {fmt12(s.end)}
                            </div>
                            <div style={{fontSize:12,color:'rgba(100,116,139,0.75)',display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
                              <span style={{display:'flex',alignItems:'center',gap:3}}><Timer size={11}/>{s.hours}h</span>
                              {s.notes && <span style={{display:'flex',alignItems:'center',gap:3}}><MapPin size={11}/>{s.notes}</span>}
                            </div>
                          </div>
                          <span className={`badge ${isBooked?'badge-blue':isFull?'badge-red':blocked?'badge-amber':'badge-green'}`}>
                            {isBooked?t('booked'):isFull?t('full'):blocked?t('limit'):t('open')}
                          </span>
                        </div>
                        <div className="cap-bar"><div className={`cap-fill ${fillClass}`} style={{width:`${Math.min(pct,100)}%`}}/></div>
                        <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'rgba(100,116,139,0.65)',marginBottom:12}}>
                          <span><Users size={10} style={{display:'inline',marginRight:3}}/>{s.booked}/{s.capacity} {t('slots')}</span>
                          <span style={{fontFamily:"'JetBrains Mono',monospace",fontWeight:700,color:pct>=100?'#fb7185':pct>=70?'#fcd34d':'#6ee7b7'}}>{pct}%</span>
                        </div>
                        {pct>=80&&!isFull&&!isBooked&&<div style={{display:'flex',alignItems:'center',gap:4,fontSize:11,color:'#fcd34d',marginBottom:10}}><Flame size={11}/>{t('fillingFast')}</div>}
                        {!isBooked&&!isFull&&!blocked&&(
                          <button onClick={()=>bookShift(s.id)} disabled={loading} className={isSuccess?'btn-success':'btn-primary'} style={{width:'100%',justifyContent:'center',padding:'10px',borderRadius:12}}>
                            {isSuccess?<><CheckCircle size={15}/>{t('booked')}</>:loading?<><Spinner size={14}/>{t('booking')}</>:<>{t('book')}<ChevronRight size={14}/></>}
                          </button>
                        )}
                        {!isBooked&&!isFull&&blocked&&(
                          <div style={{padding:'9px',borderRadius:12,fontSize:12,fontWeight:600,color:'#fcd34d',background:'rgba(245,158,11,0.1)',border:'1px solid rgba(245,158,11,0.2)',textAlign:'center'}}>
                            <AlertTriangle size={12} style={{display:'inline',marginRight:5}}/>
                            {excD?`${(DAILY_LIMIT-dailyHours).toFixed(1)}h ${t('remaining')} today`:`${(WEEKLY_LIMIT-weeklyHours).toFixed(1)}h ${t('remaining')} this week`}
                          </div>
                        )}
                        {isBooked&&myBk&&(
                          <button onClick={()=>setCancelModal({bookingId:myBk.id,reason:''})} className="btn-danger" style={{width:'100%',justifyContent:'center',padding:'10px',borderRadius:12}}>
                            <XCircle size={14}/>{t('cancel')}
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

        {/* ══ MY BOOKINGS ══ */}
        {page==='mybookings' && (
          <div className="anim-fade" dir={isRTL?'rtl':'ltr'}>
            <h1 className="page-title">{t('myBookings')}</h1>
            <p className="page-sub">{t('bookingHistory')}</p>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:20}}>
              {[{l:t('confirmed'),v:myConfirmed.length,c:'#93c5fd'},{l:t('cancelled'),v:myCancelled.length,c:'#fb7185'},{l:t('thisWeek'),v:`${weeklyHours}h`,c:'#6ee7b7'}].map(s=>(
                <div key={s.l} className="glass-card" style={{padding:'14px',textAlign:'center'}}>
                  <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:24,fontWeight:700,color:s.c}}>{s.v}</div>
                  <div style={{fontSize:11,color:'rgba(100,116,139,0.7)',marginTop:4,textTransform:'uppercase',letterSpacing:'0.08em'}}>{s.l}</div>
                </div>
              ))}
            </div>
            {myBookings.length===0&&<EmptyState icon={ClipboardList} title={t('noBookings')} description={t('noBookingsSub')}/>}
            <div style={{display:'flex',flexDirection:'column',gap:10}}>
              {[...myBookings].sort((a,b)=>{
                if (a.status!==b.status) return a.status==='Confirmed'?-1:1
                const da=a.shiftDate?a.shiftDate.split('.').reverse().join('-'):''
                const db=b.shiftDate?b.shiftDate.split('.').reverse().join('-'):''
                return da<db?-1:1
              }).map(b=>{
                const conf=b.status==='Confirmed'
                const s=shifts.find(x=>x.id===b.shiftId)
                const dDate=b.shiftDate||(s?fmtDateISO(s.date,lang):'')
                const dStart=b.startTime||s?.start||''
                const dEnd=b.endTime||s?.end||''
                const dHours=b.hours||s?.hours||0
                const dCity=b.city||s?.city||activeCity
                const sc2=cityStyle(dCity)
                return (
                  <div key={b.id} className="glass-card" style={{padding:'16px 18px',border:conf?'1px solid rgba(59,130,246,0.18)':'1px solid rgba(244,63,94,0.18)',opacity:conf?1:0.8}}>
                    <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
                      <div style={{display:'flex',gap:12}}>
                        <div style={{width:42,height:42,borderRadius:12,background:conf?'rgba(37,99,235,0.18)':'rgba(244,63,94,0.12)',display:'flex',alignItems:'center',justifyContent:'center',color:conf?'#93c5fd':'#fb7185',flexShrink:0}}>
                          <CalendarDays size={18}/>
                        </div>
                        <div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:'rgba(100,116,139,0.45)',marginBottom:3}}>{b.shiftId}</div>
                          <div style={{fontWeight:700,fontSize:14,color:'#f1f5ff',fontFamily:"'JetBrains Mono',monospace"}}>
                            {dStart?`${fmt12(dStart)} – ${fmt12(dEnd)}`:b.shiftId}
                          </div>
                          <div style={{fontSize:12,color:'rgba(148,163,184,0.75)',marginTop:3,display:'flex',flexWrap:'wrap',gap:7,alignItems:'center'}}>
                            {dDate&&<span>{dDate}</span>}
                            {dHours>0&&<span>· {dHours}h</span>}
                            {dCity&&<span style={{padding:'1px 7px',borderRadius:5,background:sc2.bg,color:sc2.text,border:`1px solid ${sc2.border}`,fontSize:11,fontWeight:600}}>{dCity}</span>}
                          </div>
                          {b.cancelReason&&<div style={{fontSize:11,color:'#fb7185',marginTop:5,display:'flex',alignItems:'center',gap:4}}><XCircle size={11}/>{b.cancelReason}</div>}
                        </div>
                      </div>
                      <div style={{display:'flex',alignItems:'center',gap:8,flexShrink:0}}>
                        <span className={`badge ${conf?'badge-blue':'badge-red'}`}>{conf?t('confirmed'):t('cancelled')}</span>
                        {conf&&<button onClick={()=>setCancelModal({bookingId:b.id,reason:''})} className="btn-danger btn-xs"><XCircle size={12}/>{t('cancel')}</button>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ══ UPCOMING ══ */}
        {page==='upcoming' && (() => {
          const today=new Date(); today.setHours(0,0,0,0)
          const upcoming=[...myConfirmed].filter(b=>{
            const s=shifts.find(x=>x.id===b.shiftId)
            const iso=b.shiftDate?toISO(b.shiftDate):(s?toISO(s.date):'')
            if (!iso) return true
            return new Date(iso+'T00:00:00')>=today
          }).sort((a,b2)=>{
            const da=a.shiftDate?a.shiftDate.split('.').reverse().join('-'):(shifts.find(x=>x.id===a.shiftId)?.date||'')
            const db=b2.shiftDate?b2.shiftDate.split('.').reverse().join('-'):(shifts.find(x=>x.id===b2.shiftId)?.date||'')
            return da<db?-1:da>db?1:(a.startTime||'').localeCompare(b2.startTime||'')
          })
          return (
            <div className="anim-fade" dir={isRTL?'rtl':'ltr'}>
              <h1 className="page-title">{t('upcoming')}</h1>
              <p className="page-sub">{t('upcomingSub')}</p>
              {upcoming.length===0&&<EmptyState icon={Clock} title={t('noUpcoming')} description={t('noUpcomingSub')}/>}
              <div style={{display:'flex',flexDirection:'column',gap:14}}>
                {upcoming.map(b=>{
                  const s=shifts.find(x=>x.id===b.shiftId)
                  const dStart=b.startTime||s?.start||''
                  const dEnd=b.endTime||s?.end||''
                  const dDate=b.shiftDate||(s?fmtDateISO(s.date,lang):'')
                  const dHours=b.hours||s?.hours||0
                  const dCity=b.city||s?.city||activeCity
                  const sc2=cityStyle(dCity)
                  return (
                    <div key={b.id} className="glass-card" style={{padding:'20px 22px',border:'1px solid rgba(59,130,246,0.15)'}}>
                      <div style={{display:'flex',justifyContent:'space-between',flexWrap:'wrap',gap:12,marginBottom:12}}>
                        <div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:9.5,color:'rgba(100,116,139,0.4)',marginBottom:4}}>{b.shiftId}</div>
                          <div style={{fontFamily:"'JetBrains Mono',monospace",fontSize:20,fontWeight:700,color:'#f1f5ff',marginBottom:4}}>
                            {dStart?`${fmt12(dStart)} – ${fmt12(dEnd)}`:b.shiftId}
                          </div>
                          <div style={{fontSize:13,color:'rgba(100,116,139,0.8)',display:'flex',flexWrap:'wrap',gap:8,alignItems:'center'}}>
                            {dDate&&<span>{dDate}</span>}
                            {dHours>0&&<span>· {dHours}h</span>}
                            {dCity&&<span style={{padding:'2px 8px',borderRadius:6,background:sc2.bg,color:sc2.text,border:`1px solid ${sc2.border}`,fontSize:12,fontWeight:600}}>{dCity}</span>}
                          </div>
                        </div>
                        <span className="badge badge-green" style={{display:'flex',alignItems:'center',gap:5,alignSelf:'flex-start'}}>
                          <span className="live-pulse"><span className="live-pulse-dot" style={{width:6,height:6}}/><span className="live-pulse-ring" style={{inset:-2}}/></span>
                          {t('upcoming')}
                        </span>
                      </div>
                      {s&&<div style={{display:'flex',gap:14,fontSize:13,color:'rgba(148,163,184,0.7)'}}>
                        <span><Users size={13} style={{display:'inline',marginRight:4}}/>{s.booked}/{s.capacity} {t('riders')}</span>
                      </div>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })()}

        {/* ══ NOTIFICATIONS ══ */}
        {page==='notifications' && (
          <div className="anim-fade" dir={isRTL?'rtl':'ltr'}>
            <h1 className="page-title">{t('notifications')}</h1>
            <p className="page-sub">{t('notifSub')}</p>
            <div className="glass-card" style={{padding:'22px',marginBottom:14,display:'flex',alignItems:'center',gap:20}}>
              <ProgressRing value={weeklyHours} max={WEEKLY_LIMIT} size={80} strokeWidth={7}
                color={weeklyHours>=WEEKLY_LIMIT?'#f43f5e':weeklyHours>=45?'#f59e0b':'#10b981'}
                label={`${weeklyHours}h`} sublabel={`/ ${WEEKLY_LIMIT}h`}/>
              <div>
                <div style={{fontWeight:700,fontSize:15,color:'#f1f5ff',marginBottom:4}}>{t('weeklyStatus')}</div>
                <div style={{fontSize:13,color:'rgba(100,116,139,0.8)',marginBottom:6}}>{Math.max(0,WEEKLY_LIMIT-weeklyHours).toFixed(1)}h {t('remaining')}</div>
                <div style={{display:'flex',alignItems:'center',gap:6}}>
                  <span style={{padding:'2px 8px',borderRadius:6,background:cs.bg,color:cs.text,border:`1px solid ${cs.border}`,fontSize:12,fontWeight:600}}>{activeCity}</span>
                </div>
              </div>
            </div>
            {weeklyCancels>0&&<div className="alert alert-warning" style={{marginBottom:12}}><AlertTriangle size={15} style={{flexShrink:0}}/><span>{weeklyCancels}/5 {t('cancelled')} this week{weeklyCancels>=4?' — Warning!':''}</span></div>}
            {myConfirmed.length===0&&<div className="alert alert-info"><Bell size={14} style={{flexShrink:0}}/> {t('noUpcomingSub')}</div>}
            {myConfirmed.map(b=>{
              const s=shifts.find(x=>x.id===b.shiftId)
              const dDate=b.shiftDate||(s?fmtDateISO(s.date,lang):'')
              const dStart=b.startTime||s?.start||''
              return (
                <div key={b.id} style={{display:'flex',gap:14,padding:'14px 16px',background:'rgba(37,99,235,0.07)',border:'1px solid rgba(59,130,246,0.18)',borderRadius:14,marginBottom:10}}>
                  <div style={{width:36,height:36,borderRadius:10,background:'rgba(37,99,235,0.2)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}><Bell size={16} color="#93c5fd"/></div>
                  <div>
                    <div style={{fontWeight:600,fontSize:13.5,color:'#e1e7f5',marginBottom:3}}>{dDate}</div>
                    <div style={{fontSize:12,color:'rgba(100,116,139,0.75)'}}>{dStart?`${fmt12(dStart)} – ${fmt12(b.endTime||s?.end||'')}`:b.shiftId}</div>
                    <div style={{fontSize:11,fontFamily:"'JetBrains Mono',monospace",color:'rgba(100,116,139,0.4)',marginTop:2}}>{b.shiftId}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Layout>

      {/* Cancel modal */}
      {cancelModal&&(
        <Modal title={t('cancelBooking')} subtitle={t('cancelSub')} onClose={()=>setCancelModal(null)}>
          {weeklyCancels>=3&&<div className="alert alert-warning" style={{marginBottom:16}}><AlertTriangle size={14} style={{flexShrink:0}}/><span>{5-weeklyCancels} {t('remaining')} this week</span></div>}
          <div style={{marginBottom:20}}>
            <label style={{display:'block',fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.1em',color:'rgba(100,116,139,0.8)',marginBottom:8}}>{t('reason')}</label>
            <select className="input-field" value={cancelModal.reason} onChange={e=>setCancelModal({...cancelModal,reason:e.target.value})}>
              <option value="">{t('selectReason')}</option>
              <option value="Personal emergency">{t('personalEmerg')}</option>
              <option value="Vehicle issue">{t('vehicleIssue')}</option>
              <option value="Medical appointment">{t('medicalAppt')}</option>
              <option value="Family matter">{t('familyMatter')}</option>
              <option value="Work conflict">{t('workConflict')}</option>
              <option value="Other">{t('other')}</option>
            </select>
          </div>
          <div style={{display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button className="btn-ghost" onClick={()=>setCancelModal(null)}>{t('keepBooking')}</button>
            <button className="btn-danger" onClick={cancelBooking} disabled={loading}>
              {loading?<Spinner size={14}/>:<XCircle size={15}/>} {t('confirmCancel')}
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
