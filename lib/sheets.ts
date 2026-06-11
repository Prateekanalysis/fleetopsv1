import { google } from 'googleapis'

const SHEET_ID = process.env.GOOGLE_SHEET_ID!

export const CITIES = ['Berlin', 'Munich', 'Frankfurt', 'Stuttgart'] as const
export type City = typeof CITIES[number]

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}
function sheets() { return google.sheets({ version: 'v4', auth: getAuth() }) }

// ═══════════════════════════════════════════════════════════
// DATE / TIME HELPERS
// ═══════════════════════════════════════════════════════════
export function toEuroDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const [y, m, d] = s.slice(0, 10).split('-')
    return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`
  }
  return s
}
export function toISODate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.')
    return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`
  }
  return s
}
export function toEuroDateTime(date: Date): string {
  const d  = String(date.getDate()).padStart(2, '0')
  const m  = String(date.getMonth() + 1).padStart(2, '0')
  const y  = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${d}.${m}.${y} ${hh}:${mm}`
}
export function toHHMM(t: string): string {
  if (!t) return ''
  const s = t.trim()
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s)
    if (!isNaN(d.getTime()))
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const parts = s.split(':')
  return `${String(parseInt(parts[0] || '0')).padStart(2,'0')}:${(parts[1] || '00').slice(0,2)}`
}

// ═══════════════════════════════════════════════════════════
// RIDERS
// Sheet "Riders" A–H (8 cols):
// MB_No | Name | City | Phone | Email | Active | Weekly_Hours | Cancellations
//
// MIGRATION NOTE: If your sheet has the OLD 7-col layout (no City),
// the parser reads City from col C and shifts Phone/Email/Active right.
// Old layout: A=MB_No B=Name C=Phone D=Email E=Active F=Hours G=Cancels
// New layout: A=MB_No B=Name C=City  D=Phone E=Email  F=Active G=Hours H=Cancels
//
// The parser detects which layout is in use by checking if col C looks like
// a phone number (starts with +) or a city name.
// ═══════════════════════════════════════════════════════════

export interface RiderRow {
  nb:            string
  name:          string
  city:          string
  phone:         string
  email:         string
  active:        boolean
  weeklyHours:   number
  cancellations: number
}

function parseActive(v: string): boolean {
  return ['TRUE','YES','Y','1','ACTIVE'].includes((v || 'TRUE').toUpperCase().trim())
}

function detectRiderLayout(r: string[]): 'new' | 'old' {
  // New layout has city in col C — check if it's a known city or phone-shaped
  const col2 = (r[2] || '').trim()
  if (!col2) return 'old'
  if (col2.startsWith('+') || /^\d{5,}/.test(col2)) return 'old'
  return 'new'
}

export async function getRiders(): Promise<RiderRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: 'Riders!A2:H',
    })
    return (res.data.values || []).map(r => {
      const layout = detectRiderLayout(r)
      if (layout === 'new') {
        return {
          nb:            (r[0] || '').trim(),
          name:          (r[1] || '').trim(),
          city:          (r[2] || '').trim(),
          phone:         (r[3] || '').trim(),
          email:         (r[4] || '').trim(),
          active:        parseActive(r[5] || ''),
          weeklyHours:   parseFloat(r[6] || '0'),
          cancellations: parseInt(r[7] || '0'),
        }
      } else {
        // Old 7-col layout — city is empty
        return {
          nb:            (r[0] || '').trim(),
          name:          (r[1] || '').trim(),
          city:          '',
          phone:         (r[2] || '').trim(),
          email:         (r[3] || '').trim(),
          active:        parseActive(r[4] || ''),
          weeklyHours:   parseFloat(r[5] || '0'),
          cancellations: parseInt(r[6] || '0'),
        }
      }
    }).filter(r => r.nb)
  } catch (e: any) {
    throw new Error(`[getRiders] ${e.message}`)
  }
}

export async function addRiderToSheet(rider: {
  nb: string; name: string; city: string; phone: string; email: string
}) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Riders!A:H',
    valueInputOption: 'RAW',
    requestBody: { values: [[rider.nb, rider.name, rider.city, rider.phone, rider.email, 'TRUE', '0', '0']] },
  })
}

export async function updateRiderInSheet(nb: string, fields: {
  active?: boolean; weeklyHours?: number; cancellations?: number
  name?: string; city?: string; phone?: string; email?: string
}) {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Riders!A2:H' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === nb)
  if (idx === -1) { console.warn(`[updateRiderInSheet] ${nb} not found`); return }
  const row    = idx + 2
  const layout = detectRiderLayout(rows[idx])
  const data: { range: string; values: any[][] }[] = []
  if (layout === 'new') {
    if (fields.name          !== undefined) data.push({ range: `Riders!B${row}`, values: [[fields.name]] })
    if (fields.city          !== undefined) data.push({ range: `Riders!C${row}`, values: [[fields.city]] })
    if (fields.phone         !== undefined) data.push({ range: `Riders!D${row}`, values: [[fields.phone]] })
    if (fields.email         !== undefined) data.push({ range: `Riders!E${row}`, values: [[fields.email]] })
    if (fields.active        !== undefined) data.push({ range: `Riders!F${row}`, values: [[fields.active ? 'TRUE' : 'FALSE']] })
    if (fields.weeklyHours   !== undefined) data.push({ range: `Riders!G${row}`, values: [[String(fields.weeklyHours)]] })
    if (fields.cancellations !== undefined) data.push({ range: `Riders!H${row}`, values: [[String(fields.cancellations)]] })
  } else {
    // old layout — no city column
    if (fields.name          !== undefined) data.push({ range: `Riders!B${row}`, values: [[fields.name]] })
    if (fields.phone         !== undefined) data.push({ range: `Riders!C${row}`, values: [[fields.phone]] })
    if (fields.email         !== undefined) data.push({ range: `Riders!D${row}`, values: [[fields.email]] })
    if (fields.active        !== undefined) data.push({ range: `Riders!E${row}`, values: [[fields.active ? 'TRUE' : 'FALSE']] })
    if (fields.weeklyHours   !== undefined) data.push({ range: `Riders!F${row}`, values: [[String(fields.weeklyHours)]] })
    if (fields.cancellations !== undefined) data.push({ range: `Riders!G${row}`, values: [[String(fields.cancellations)]] })
  }
  if (!data.length) return
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID, requestBody: { valueInputOption: 'RAW', data },
  })
}

// ═══════════════════════════════════════════════════════════
// SHIFTS
// Sheet "Shifts" A–K (11 cols):
// ShiftID | City | Date | Day | Start | End | Hours | Capacity | Booked | Status | Notes
//
// MIGRATION: Old 10-col had no City (ShiftID|Date|Day|Start|End|Hours|Cap|Booked|Status|Notes)
// Detected by checking if col B looks like a date (YYYY-MM-DD) or a city name.
// ═══════════════════════════════════════════════════════════

export interface ShiftRow {
  id:       string
  city:     string
  date:     string  // YYYY-MM-DD
  day:      string
  start:    string  // HH:mm
  end:      string  // HH:mm
  hours:    number
  capacity: number
  booked:   number
  status:   string
  notes:    string
}

function detectShiftLayout(r: string[]): 'new' | 'old' {
  const col1 = (r[1] || '').trim()
  if (!col1) return 'old'
  // If col B is a date (YYYY-MM-DD or DD.MM.YYYY), it's old layout
  if (/^\d{4}-\d{2}-\d{2}/.test(col1) || /^\d{2}\.\d{2}\.\d{4}/.test(col1)) return 'old'
  return 'new'
}

export async function getShifts(): Promise<ShiftRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: 'Shifts!A2:K',
    })
    return (res.data.values || []).map(r => {
      const layout = detectShiftLayout(r)
      if (layout === 'new') {
        return {
          id:       (r[0] || '').trim(),
          city:     (r[1] || '').trim(),
          date:     (r[2] || '').trim(),
          day:      (r[3] || '').trim(),
          start:    (r[4] || '').trim(),
          end:      (r[5] || '').trim(),
          hours:    parseFloat(r[6] || '0'),
          capacity: parseInt(r[7] || '5'),
          booked:   parseInt(r[8] || '0'),
          status:   (r[9] || 'OPEN').trim(),
          notes:    (r[10] || '').trim(),
        }
      } else {
        return {
          id:       (r[0] || '').trim(),
          city:     '',
          date:     (r[1] || '').trim(),
          day:      (r[2] || '').trim(),
          start:    (r[3] || '').trim(),
          end:      (r[4] || '').trim(),
          hours:    parseFloat(r[5] || '0'),
          capacity: parseInt(r[6] || '5'),
          booked:   parseInt(r[7] || '0'),
          status:   (r[8] || 'OPEN').trim(),
          notes:    (r[9] || '').trim(),
        }
      }
    }).filter(s => s.id)
  } catch (e: any) {
    throw new Error(`[getShifts] ${e.message}`)
  }
}

export async function addShiftToSheet(shift: {
  id: string; city: string; date: string; day: string; start: string
  end: string; hours: number; capacity: number; notes: string
}) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Shifts!A:K',
    valueInputOption: 'RAW',
    requestBody: { values: [[
      shift.id, shift.city, shift.date, shift.day,
      toHHMM(shift.start), toHHMM(shift.end),
      shift.hours, shift.capacity, 0, 'OPEN', shift.notes,
    ]] },
  })
}

export async function updateShiftInSheet(id: string, fields: {
  booked?: number; status?: string; capacity?: number
  start?: string; end?: string; notes?: string; city?: string
}) {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:K' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === id)
  if (idx === -1) { console.warn(`[updateShiftInSheet] ${id} not found`); return }
  const row    = idx + 2
  const layout = detectShiftLayout(rows[idx])
  const data: { range: string; values: any[][] }[] = []
  if (layout === 'new') {
    if (fields.city     !== undefined) data.push({ range: `Shifts!B${row}`,  values: [[fields.city]] })
    if (fields.start    !== undefined) data.push({ range: `Shifts!E${row}`,  values: [[toHHMM(fields.start)]] })
    if (fields.end      !== undefined) data.push({ range: `Shifts!F${row}`,  values: [[toHHMM(fields.end)]] })
    if (fields.capacity !== undefined) data.push({ range: `Shifts!H${row}`,  values: [[String(fields.capacity)]] })
    if (fields.booked   !== undefined) data.push({ range: `Shifts!I${row}`,  values: [[String(fields.booked)]] })
    if (fields.status   !== undefined) data.push({ range: `Shifts!J${row}`,  values: [[fields.status]] })
    if (fields.notes    !== undefined) data.push({ range: `Shifts!K${row}`,  values: [[fields.notes]] })
  } else {
    if (fields.start    !== undefined) data.push({ range: `Shifts!D${row}`,  values: [[toHHMM(fields.start)]] })
    if (fields.end      !== undefined) data.push({ range: `Shifts!E${row}`,  values: [[toHHMM(fields.end)]] })
    if (fields.capacity !== undefined) data.push({ range: `Shifts!G${row}`,  values: [[String(fields.capacity)]] })
    if (fields.booked   !== undefined) data.push({ range: `Shifts!H${row}`,  values: [[String(fields.booked)]] })
    if (fields.status   !== undefined) data.push({ range: `Shifts!I${row}`,  values: [[fields.status]] })
    if (fields.notes    !== undefined) data.push({ range: `Shifts!J${row}`,  values: [[fields.notes]] })
  }
  if (!data.length) return
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID, requestBody: { valueInputOption: 'RAW', data },
  })
}

export async function deleteShiftFromSheet(id: string) {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:K' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID, range: `Shifts!A${idx+2}:K${idx+2}`,
  })
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS — 14 columns A–N
// A  Booking_ID   B  MB_No      C  Rider_Name  D  City
// E  Shift_ID     F  Shift_Date G  Day         H  Start_Time
// I  End_Time     J  Hours      K  Status      L  Cancel_Reason
// M  Created_At   N  Updated_At
// ═══════════════════════════════════════════════════════════

export const BOOKING_HEADERS = [
  'Booking_ID', 'MB_No', 'Rider_Name', 'City',
  'Shift_ID', 'Shift_Date', 'Day', 'Start_Time', 'End_Time', 'Hours',
  'Status', 'Cancel_Reason', 'Created_At', 'Updated_At',
]

export interface BookingRow {
  id:           string
  riderNb:      string
  riderName:    string
  city:         string
  shiftId:      string
  shiftDate:    string  // DD.MM.YYYY
  day:          string
  startTime:    string  // HH:mm
  endTime:      string  // HH:mm
  hours:        number
  status:       string
  cancelReason: string
  createdAt:    string
  updatedAt:    string
}

// Detects old 13-col schema (no City) vs new 14-col schema
function detectBookingLayout(r: string[]): 'new' | 'old' {
  // New: col D is city (Berlin/Munich/etc)
  // Old: col D is Shift_ID (starts with SH or BK pattern)
  const col3 = (r[3] || '').trim()
  if (!col3) return 'old'
  if (CITIES.includes(col3 as City)) return 'new'
  if (/^SH\d/i.test(col3) || /^BK\d/i.test(col3)) return 'old'
  // Heuristic: if it looks like a date, it's old schema shifted
  if (/^\d{2}\.\d{2}/.test(col3)) return 'old'
  return 'new'
}

export function normalizeBookingRow(r: string[]): BookingRow {
  const layout = detectBookingLayout(r)
  if (layout === 'new') {
    const status = (r[10] || 'Confirmed').trim()
    return {
      id:           (r[0]  || '').trim(),
      riderNb:      (r[1]  || '').trim(),
      riderName:    (r[2]  || '').trim(),
      city:         (r[3]  || '').trim(),
      shiftId:      (r[4]  || '').trim(),
      shiftDate:    toEuroDate((r[5]  || '').trim()),
      day:          (r[6]  || '').trim(),
      startTime:    toHHMM((r[7]  || '').trim()),
      endTime:      toHHMM((r[8]  || '').trim()),
      hours:        parseFloat(r[9]  || '0'),
      status:       status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
      cancelReason: (r[11] || '').trim(),
      createdAt:    (r[12] || '').trim(),
      updatedAt:    (r[13] || '').trim(),
    }
  } else {
    // Old 13-col: no City — col D is Shift_ID
    const status = (r[9] || 'Confirmed').trim()
    return {
      id:           (r[0]  || '').trim(),
      riderNb:      (r[1]  || '').trim(),
      riderName:    (r[2]  || '').trim(),
      city:         '',
      shiftId:      (r[3]  || '').trim(),
      shiftDate:    toEuroDate((r[4]  || '').trim()),
      day:          (r[5]  || '').trim(),
      startTime:    toHHMM((r[6]  || '').trim()),
      endTime:      toHHMM((r[7]  || '').trim()),
      hours:        parseFloat(r[8]  || '0'),
      status:       status === 'Cancelled' ? 'Cancelled' : 'Confirmed',
      cancelReason: (r[10] || '').trim(),
      createdAt:    (r[11] || '').trim(),
      updatedAt:    (r[12] || '').trim(),
    }
  }
}

export async function getBookings(): Promise<BookingRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: 'Bookings!A2:N',
    })
    return (res.data.values || [])
      .map(r => normalizeBookingRow(r as string[]))
      .filter(b => b.id)
  } catch (e: any) {
    throw new Error(`[getBookings] ${e.message}`)
  }
}

export async function addBookingToSheet(params: {
  id: string; riderNb: string; riderName: string; city: string
  shift: { id: string; date: string; day: string; start: string; end: string; hours: number }
}) {
  const { id, riderNb, riderName, city, shift } = params
  const now           = new Date()
  const ts            = toEuroDateTime(now)
  const shiftDateEuro = toEuroDate(shift.date)
  const startHHMM     = toHHMM(shift.start)
  const endHHMM       = toHHMM(shift.end)
  const hoursNum      = Number(shift.hours)

  if (!id || !riderNb || !shift.id)
    throw new Error(`addBookingToSheet: missing fields id=${id} riderNb=${riderNb} shiftId=${shift.id}`)
  if (!shiftDateEuro || !/^\d{2}\.\d{2}\.\d{4}$/.test(shiftDateEuro))
    throw new Error(`addBookingToSheet: invalid date "${shift.date}" → "${shiftDateEuro}"`)
  if (!startHHMM || !endHHMM)
    throw new Error(`addBookingToSheet: invalid times start="${shift.start}" end="${shift.end}"`)

  const row = [
    id,            // A  Booking_ID
    riderNb,       // B  MB_No
    riderName,     // C  Rider_Name
    city,          // D  City
    shift.id,      // E  Shift_ID
    shiftDateEuro, // F  Shift_Date
    shift.day,     // G  Day
    startHHMM,     // H  Start_Time
    endHHMM,       // I  End_Time
    hoursNum,      // J  Hours
    'Confirmed',   // K  Status
    '',            // L  Cancel_Reason
    ts,            // M  Created_At
    ts,            // N  Updated_At
  ]
  console.log(`[addBookingToSheet] ${id} | ${riderNb} | ${city} | ${shift.id} | ${shiftDateEuro} ${startHHMM}–${endHHMM} ${hoursNum}h`)
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Bookings!A:N',
    valueInputOption: 'RAW', requestBody: { values: [row] },
  })
}

export async function cancelBookingInSheet(bookingId: string, reason: string): Promise<void> {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Bookings!A2:N' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => (r[0] || '').trim() === bookingId)
  if (idx === -1) { console.warn(`[cancelBookingInSheet] ${bookingId} not found`); return }
  const row    = idx + 2
  const ts     = toEuroDateTime(new Date())
  const layout = detectBookingLayout(rows[idx])
  // Status col: K=new(col11), J=old(col10) — use layout-aware cols
  const statusCol   = layout === 'new' ? `K${row}` : `J${row}`
  const reasonCol   = layout === 'new' ? `L${row}` : `K${row}`
  const updatedCol  = layout === 'new' ? `N${row}` : `M${row}`
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `Bookings!${statusCol}`,  values: [['Cancelled']] },
        { range: `Bookings!${reasonCol}`,  values: [[reason]] },
        { range: `Bookings!${updatedCol}`, values: [[ts]] },
      ],
    },
  })
}

export async function ensureBookingsHeaders(): Promise<void> {
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: 'Bookings!A1:N1',
    valueInputOption: 'RAW', requestBody: { values: [BOOKING_HEADERS] },
  })
  console.log('[ensureBookingsHeaders]', BOOKING_HEADERS.join(' | '))
}
