import { google } from 'googleapis'

const SHEET_ID = process.env.GOOGLE_SHEET_ID!

// ═══════════════════════════════════════════════════════════
// CITY CONFIGURATION
// Tab names in Google Sheets — must match EXACTLY (case-sensitive)
// ═══════════════════════════════════════════════════════════
export const CITIES = ['Berlin', 'Munich', 'Frankfurt', 'Stuttgart'] as const
export type City = typeof CITIES[number]

// Map city → exact Google Sheets tab name
// If the user names their tabs slightly differently, update here ONLY
export const CITY_TAB: Record<string, string> = {
  'Berlin':    'Berlin Shifts',
  'Munich':    'Munich Shifts',
  'Frankfurt': 'Frankfurt Shifts',
  'Stuttgart': 'Stuttgart Shifts',
}

// Reverse map: tab name → city
const TAB_CITY: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_TAB).map(([city, tab]) => [tab, city])
)

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}
function sheetsClient() { return google.sheets({ version: 'v4', auth: getAuth() }) }

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
// Sheet tab name: "Riders"
// Columns A–H: MB_No | Name | City | Phone | Email | Active | Weekly_Hours | Cancellations
//
// Backward compat: if col C looks like a phone number (starts with +),
// treats it as the old 7-col layout (no City column).
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
  return ['TRUE','YES','Y','1','ACTIVE'].includes((v || '').toUpperCase().trim())
}

function detectRiderLayout(r: string[]): 'new' | 'old' {
  const col2 = (r[2] || '').trim()
  if (!col2) return 'old'
  if (col2.startsWith('+') || /^\d{5,}/.test(col2)) return 'old'
  return 'new'
}

export async function getRiders(): Promise<RiderRow[]> {
  try {
    const res = await sheetsClient().spreadsheets.values.get({
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
    console.error('[getRiders]', e.message)
    throw new Error(`Failed to read Riders sheet: ${e.message}`)
  }
}

export async function addRiderToSheet(rider: {
  nb: string; name: string; city: string; phone: string; email: string
}) {
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Riders!A:H',
    valueInputOption: 'RAW',
    requestBody: { values: [[rider.nb, rider.name, rider.city, rider.phone, rider.email, 'TRUE', '0', '0']] },
  })
}

export async function updateRiderInSheet(nb: string, fields: {
  active?: boolean; weeklyHours?: number; cancellations?: number
  name?: string; city?: string; phone?: string; email?: string
}) {
  const res  = await sheetsClient().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Riders!A2:H' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => (r[0] || '').trim() === nb)
  if (idx === -1) { console.warn(`[updateRiderInSheet] Rider ${nb} not found`); return }
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
    if (fields.name          !== undefined) data.push({ range: `Riders!B${row}`, values: [[fields.name]] })
    if (fields.phone         !== undefined) data.push({ range: `Riders!C${row}`, values: [[fields.phone]] })
    if (fields.email         !== undefined) data.push({ range: `Riders!D${row}`, values: [[fields.email]] })
    if (fields.active        !== undefined) data.push({ range: `Riders!E${row}`, values: [[fields.active ? 'TRUE' : 'FALSE']] })
    if (fields.weeklyHours   !== undefined) data.push({ range: `Riders!F${row}`, values: [[String(fields.weeklyHours)]] })
    if (fields.cancellations !== undefined) data.push({ range: `Riders!G${row}`, values: [[String(fields.cancellations)]] })
  }
  if (!data.length) return
  await sheetsClient().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID, requestBody: { valueInputOption: 'RAW', data },
  })
}

// ═══════════════════════════════════════════════════════════
// SHIFTS — MULTI-TAB ARCHITECTURE
//
// Each city has its own tab:
//   "Berlin Shifts" | "Frankfurt Shifts" | "Munich Shifts" | "Stuttgart Shifts"
//
// Each tab columns (A–K):
//   ShiftID | Date | Day | Start | End | Hours | Capacity | Booked | Available | Status | Notes
//   (City is derived from the tab name, not stored as a column)
//
// If a tab doesn't exist or is empty, it is skipped gracefully — no crash.
// All tabs are read in parallel for performance.
// ═══════════════════════════════════════════════════════════

export interface ShiftRow {
  id:       string
  city:     string   // injected from tab name
  tabName:  string   // exact Google Sheets tab name for writes
  rowIndex: number   // 1-based row in sheet (for updates)
  date:     string   // YYYY-MM-DD
  day:      string
  start:    string   // HH:mm
  end:      string   // HH:mm
  hours:    number
  capacity: number
  booked:   number
  available:number
  status:   string
  notes:    string
}

// Parse a single row from a city shift tab
// Columns: ShiftID | Date | Day | Start | End | Hours | Capacity | Booked | Available | Status | Notes
function parseShiftRow(r: string[], city: string, tabName: string, rowIndex: number): ShiftRow | null {
  const id = (r[0] || '').trim()
  if (!id) return null

  const booked   = parseInt(r[7] || '0') || 0
  const capacity = parseInt(r[6] || '5') || 5
  return {
    id,
    city,
    tabName,
    rowIndex,
    date:      (r[1] || '').trim(),
    day:       (r[2] || '').trim(),
    start:     toHHMM((r[3] || '').trim()),
    end:       toHHMM((r[4] || '').trim()),
    hours:     parseFloat(r[5] || '0') || 0,
    capacity,
    booked,
    available: Math.max(0, capacity - booked),
    status:    (r[9] || 'OPEN').trim(),
    notes:     (r[10] || '').trim(),
  }
}

// Read one city tab — returns [] if tab doesn't exist or is empty
async function readCityTab(tabName: string, city: string): Promise<ShiftRow[]> {
  try {
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${tabName}'!A2:K`,   // quotes handle spaces in tab names
    })
    const rows = res.data.values || []
    const shifts: ShiftRow[] = []
    rows.forEach((r, i) => {
      const shift = parseShiftRow(r as string[], city, tabName, i + 2)
      if (shift) shifts.push(shift)
    })
    console.log(`[readCityTab] "${tabName}" → ${shifts.length} shifts`)
    return shifts
  } catch (e: any) {
    // Tab doesn't exist or access error — skip gracefully
    console.warn(`[readCityTab] "${tabName}" skipped: ${e.message}`)
    return []
  }
}

// Read ALL city tabs in parallel, combine and return
export async function getShifts(): Promise<ShiftRow[]> {
  try {
    const results = await Promise.all(
      Object.entries(CITY_TAB).map(([city, tabName]) => readCityTab(tabName, city))
    )
    const allShifts = results.flat()
    console.log(`[getShifts] Total shifts loaded: ${allShifts.length}`)
    return allShifts
  } catch (e: any) {
    console.error('[getShifts]', e.message)
    throw new Error(`Failed to read shift tabs: ${e.message}`)
  }
}

// Add a shift to the correct city tab
export async function addShiftToSheet(shift: {
  id: string; city: string; date: string; day: string; start: string
  end: string; hours: number; capacity: number; notes: string
}) {
  const tabName = CITY_TAB[shift.city]
  if (!tabName) throw new Error(`Unknown city "${shift.city}" — must be one of: ${Object.keys(CITY_TAB).join(', ')}`)

  const available = shift.capacity  // new shift has 0 booked
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `'${tabName}'!A:K`,
    valueInputOption: 'RAW',
    requestBody: { values: [[
      shift.id,           // A  ShiftID
      shift.date,         // B  Date
      shift.day,          // C  Day
      toHHMM(shift.start),// D  Start
      toHHMM(shift.end),  // E  End
      shift.hours,        // F  Hours
      shift.capacity,     // G  Capacity
      0,                  // H  Booked
      available,          // I  Available
      'OPEN',             // J  Status
      shift.notes,        // K  Notes
    ]] },
  })
  console.log(`[addShiftToSheet] ${shift.id} → "${tabName}"`)
}

// Update booked/status/capacity on a shift — finds the correct tab by shiftId
export async function updateShiftInSheet(id: string, fields: {
  booked?: number; status?: string; capacity?: number
  start?: string; end?: string; notes?: string
}) {
  // Search all city tabs to find this shift
  for (const [city, tabName] of Object.entries(CITY_TAB)) {
    try {
      const res  = await sheetsClient().spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: `'${tabName}'!A2:K`,
      })
      const rows = res.data.values || []
      const idx  = rows.findIndex(r => (r[0] || '').trim() === id)
      if (idx === -1) continue   // not in this tab, try next

      const row  = idx + 2
      const data: { range: string; values: any[][] }[] = []
      const cap     = fields.capacity ?? parseInt(rows[idx][6] || '5') ?? 5
      const booked  = fields.booked   ?? parseInt(rows[idx][7] || '0') ?? 0
      const avail   = Math.max(0, cap - booked)

      if (fields.start    !== undefined) data.push({ range: `'${tabName}'!D${row}`, values: [[toHHMM(fields.start)]] })
      if (fields.end      !== undefined) data.push({ range: `'${tabName}'!E${row}`, values: [[toHHMM(fields.end)]] })
      if (fields.capacity !== undefined) data.push({ range: `'${tabName}'!G${row}`, values: [[String(cap)]] })
      if (fields.booked   !== undefined) {
        data.push({ range: `'${tabName}'!H${row}`, values: [[String(booked)]] })
        data.push({ range: `'${tabName}'!I${row}`, values: [[String(avail)]] })
      }
      if (fields.status   !== undefined) data.push({ range: `'${tabName}'!J${row}`, values: [[fields.status]] })
      if (fields.notes    !== undefined) data.push({ range: `'${tabName}'!K${row}`, values: [[fields.notes]] })

      if (!data.length) return
      await sheetsClient().spreadsheets.values.batchUpdate({
        spreadsheetId: SHEET_ID, requestBody: { valueInputOption: 'RAW', data },
      })
      console.log(`[updateShiftInSheet] ${id} in "${tabName}" row ${row}`)
      return  // done
    } catch (e: any) {
      console.warn(`[updateShiftInSheet] error checking "${tabName}": ${e.message}`)
      continue
    }
  }
  console.warn(`[updateShiftInSheet] Shift ${id} not found in any city tab`)
}

// Delete a shift row — finds the correct tab by shiftId
export async function deleteShiftFromSheet(id: string) {
  for (const [city, tabName] of Object.entries(CITY_TAB)) {
    try {
      const res  = await sheetsClient().spreadsheets.values.get({
        spreadsheetId: SHEET_ID, range: `'${tabName}'!A2:K`,
      })
      const rows = res.data.values || []
      const idx  = rows.findIndex(r => (r[0] || '').trim() === id)
      if (idx === -1) continue

      await sheetsClient().spreadsheets.values.clear({
        spreadsheetId: SHEET_ID, range: `'${tabName}'!A${idx+2}:K${idx+2}`,
      })
      console.log(`[deleteShiftFromSheet] ${id} cleared from "${tabName}"`)
      return
    } catch (e: any) {
      console.warn(`[deleteShiftFromSheet] error checking "${tabName}": ${e.message}`)
      continue
    }
  }
  console.warn(`[deleteShiftFromSheet] Shift ${id} not found in any tab`)
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS
// Tab name: "Bookings"
// Columns A–N (14 cols):
// Booking_ID | MB_No | Rider_Name | City | Shift_ID | Shift_Date | Day
// Start_Time | End_Time | Hours | Status | Cancel_Reason | Created_At | Updated_At
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
  shiftDate:    string   // DD.MM.YYYY
  day:          string
  startTime:    string   // HH:mm
  endTime:      string   // HH:mm
  hours:        number
  status:       string
  cancelReason: string
  createdAt:    string
  updatedAt:    string
}

// Auto-detect if row is new 14-col (has city in col D) or old 13-col (no city)
function detectBookingLayout(r: string[]): 'new' | 'old' {
  const col3 = (r[3] || '').trim()
  if (!col3) return 'old'
  if (CITIES.includes(col3 as City)) return 'new'
  // col D looks like a shift ID or date → old layout
  if (/^SH\d/i.test(col3) || /^BK\d/i.test(col3)) return 'old'
  if (/^\d{2}\./.test(col3)) return 'old'
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
    // Old 13-col — no city column; Shift_ID in col D
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
    const res = await sheetsClient().spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: 'Bookings!A2:N',
    })
    return (res.data.values || [])
      .map(r => normalizeBookingRow(r as string[]))
      .filter(b => b.id)
  } catch (e: any) {
    console.error('[getBookings]', e.message)
    throw new Error(`Failed to read Bookings sheet: ${e.message}`)
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
    throw new Error(`Missing booking fields: id=${id} riderNb=${riderNb} shiftId=${shift.id}`)
  if (!shiftDateEuro || !/^\d{2}\.\d{2}\.\d{4}$/.test(shiftDateEuro))
    throw new Error(`Invalid shift date: "${shift.date}" → "${shiftDateEuro}"`)
  if (!startHHMM || !endHHMM)
    throw new Error(`Invalid shift times: start="${shift.start}" end="${shift.end}"`)

  const row = [
    id,            // A
    riderNb,       // B
    riderName,     // C
    city,          // D
    shift.id,      // E
    shiftDateEuro, // F
    shift.day,     // G
    startHHMM,     // H
    endHHMM,       // I
    hoursNum,      // J
    'Confirmed',   // K
    '',            // L
    ts,            // M
    ts,            // N
  ]
  console.log(`[addBookingToSheet] ${id} | ${riderNb} | ${city} | ${shift.id} | ${shiftDateEuro} ${startHHMM}–${endHHMM} ${hoursNum}h`)
  await sheetsClient().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Bookings!A:N',
    valueInputOption: 'RAW', requestBody: { values: [row] },
  })
}

export async function cancelBookingInSheet(bookingId: string, reason: string): Promise<void> {
  const res  = await sheetsClient().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Bookings!A2:N' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => (r[0] || '').trim() === bookingId)
  if (idx === -1) { console.warn(`[cancelBookingInSheet] ${bookingId} not found`); return }
  const row    = idx + 2
  const ts     = toEuroDateTime(new Date())
  const layout = detectBookingLayout(rows[idx])
  const statusCol  = layout === 'new' ? `K${row}` : `J${row}`
  const reasonCol  = layout === 'new' ? `L${row}` : `K${row}`
  const updatedCol = layout === 'new' ? `N${row}` : `M${row}`
  await sheetsClient().spreadsheets.values.batchUpdate({
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
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: 'Bookings!A1:N1',
    valueInputOption: 'RAW', requestBody: { values: [BOOKING_HEADERS] },
  })
  console.log('[ensureBookingsHeaders]', BOOKING_HEADERS.join(' | '))
}

// Ensure headers on a city shift tab
export async function ensureShiftTabHeaders(city: string): Promise<void> {
  const tabName = CITY_TAB[city]
  if (!tabName) throw new Error(`Unknown city: ${city}`)
  const headers = ['ShiftID','Date','Day','Start','End','Hours','Capacity','Booked','Available','Status','Notes']
  await sheetsClient().spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: `'${tabName}'!A1:K1`,
    valueInputOption: 'RAW', requestBody: { values: [headers] },
  })
  console.log(`[ensureShiftTabHeaders] "${tabName}"`)
}
