import { google } from 'googleapis'

const SHEET_ID = process.env.GOOGLE_SHEET_ID!

function getAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

function sheets() {
  return google.sheets({ version: 'v4', auth: getAuth() })
}

// ═══════════════════════════════════════════════════════════
// DATE / TIME HELPERS
// ═══════════════════════════════════════════════════════════

/**
 * Convert any date string → "DD.MM.YYYY"
 * Handles: "2026-06-01", "2026-06-01T07:32:29.581Z", "01.06.2026"
 */
export function toEuroDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s          // already correct
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {                    // ISO or YYYY-MM-DD
    const [y, m, d] = s.slice(0, 10).split('-')
    return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`
  }
  return s
}

/**
 * Convert DD.MM.YYYY or YYYY-MM-DD → "YYYY-MM-DD" (for date arithmetic)
 */
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

/**
 * Date object → "DD.MM.YYYY HH:mm"  (European datetime, no ISO)
 */
export function toEuroDateTime(date: Date): string {
  const d  = String(date.getDate()).padStart(2, '0')
  const m  = String(date.getMonth() + 1).padStart(2, '0')
  const y  = date.getFullYear()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${d}.${m}.${y} ${hh}:${mm}`
}

/**
 * Any time string → "HH:mm"
 * Handles: "09:00", "9:00", "2026-06-01T09:00:00.000Z"
 */
export function toHHMM(t: string): string {
  if (!t) return ''
  const s = t.trim()
  if (s.includes('T') || s.includes('Z')) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
    }
  }
  const parts = s.split(':')
  return `${String(parseInt(parts[0] || '0')).padStart(2,'0')}:${(parts[1] || '00').slice(0,2)}`
}

// ═══════════════════════════════════════════════════════════
// BOOKING SCHEMA — 13 columns A–M
// ═══════════════════════════════════════════════════════════
//
// Col  Header         Example
// A    Booking_ID     BK001
// B    MB_No          MB1001
// C    Rider_Name     James Walker
// D    Shift_ID       SH001
// E    Shift_Date     03.06.2026        ← DD.MM.YYYY, never ISO
// F    Day            Wednesday
// G    Start_Time     09:00             ← HH:mm only
// H    End_Time       17:00             ← HH:mm only
// I    Hours          8                 ← numeric, no "h" suffix
// J    Status         Confirmed
// K    Cancel_Reason  (empty unless Cancelled)
// L    Created_At     03.06.2026 09:01  ← DD.MM.YYYY HH:mm
// M    Updated_At     03.06.2026 09:01  ← same as Created_At on creation

export const BOOKING_HEADERS = [
  'Booking_ID', 'MB_No', 'Rider_Name', 'Shift_ID',
  'Shift_Date', 'Day', 'Start_Time', 'End_Time', 'Hours',
  'Status', 'Cancel_Reason', 'Created_At', 'Updated_At',
]

export interface BookingRow {
  id:           string   // A
  riderNb:      string   // B
  riderName:    string   // C
  shiftId:      string   // D
  shiftDate:    string   // E  — DD.MM.YYYY
  day:          string   // F
  startTime:    string   // G  — HH:mm
  endTime:      string   // H  — HH:mm
  hours:        number   // I
  status:       string   // J
  cancelReason: string   // K
  createdAt:    string   // L  — DD.MM.YYYY HH:mm
  updatedAt:    string   // M  — DD.MM.YYYY HH:mm
}

// ═══════════════════════════════════════════════════════════
// normalizeBookingRow — safe column mapper
// Reads raw sheet row → BookingRow, handles any column drift
// ═══════════════════════════════════════════════════════════
export function normalizeBookingRow(r: string[]): BookingRow {
  const id           = (r[0] || '').trim()
  const riderNb      = (r[1] || '').trim()
  const riderName    = (r[2] || '').trim()
  const shiftId      = (r[3] || '').trim()
  const shiftDateRaw = (r[4] || '').trim()
  const day          = (r[5] || '').trim()
  const startRaw     = (r[6] || '').trim()
  const endRaw       = (r[7] || '').trim()
  const hoursRaw     = (r[8] || '').trim()
  const status       = (r[9] || 'Confirmed').trim()
  const cancelReason = (r[10] || '').trim()
  const createdAt    = (r[11] || '').trim()
  const updatedAt    = (r[12] || '').trim()

  // Sanitise each field — never let an ISO bleed through
  const normalizedStatus = status === 'Cancelled' ? 'Cancelled' : 'Confirmed'
  return {
    id,
    riderNb,
    riderName,
    shiftId,
    shiftDate:    toEuroDate(shiftDateRaw),   // always DD.MM.YYYY
    day,
    startTime:    toHHMM(startRaw),           // always HH:mm
    endTime:      toHHMM(endRaw),             // always HH:mm
    hours:        parseFloat(hoursRaw) || 0,
    status:       normalizedStatus,
    cancelReason: cancelReason,               // preserve for all rows
    createdAt,
    updatedAt,
  }
}

// ═══════════════════════════════════════════════════════════
// RIDERS
// Sheet "Riders" A–G:
// NB_Number | Name | Phone | Email | Active | Weekly_Hours | Cancellations
// ═══════════════════════════════════════════════════════════

export async function getRiders() {
  try {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Riders!A2:G',
  })
  return (res.data.values || []).map(r => ({
    nb:            (r[0] || '').trim(),
    name:          (r[1] || '').trim(),
    phone:         (r[2] || '').trim(),
    email:         (r[3] || '').trim(),
    active:        (r[4] || 'TRUE').toUpperCase().trim() === 'TRUE',
    weeklyHours:   parseFloat(r[5] || '0'),
    cancellations: parseInt(r[6] || '0'),
  })).filter(r => r.nb)
  } catch (e: any) {
    throw new Error(`[getRiders] Google Sheets error: ${e.message}`)
  }
}

export async function addRiderToSheet(rider: {
  nb: string; name: string; phone: string; email: string
}) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Riders!A:G',
    valueInputOption: 'RAW',
    requestBody: { values: [[rider.nb, rider.name, rider.phone, rider.email, 'TRUE', '0', '0']] },
  })
}

export async function updateRiderInSheet(nb: string, fields: {
  active?: boolean; weeklyHours?: number; cancellations?: number
  name?: string; phone?: string; email?: string
}) {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Riders!A2:G' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === nb)
  if (idx === -1) {
    console.warn(`[updateRiderInSheet] Rider ${nb} not found in sheet`)
    return
  }
  const row  = idx + 2
  const data: { range: string; values: any[][] }[] = []
  if (fields.name          !== undefined) data.push({ range: `Riders!B${row}`, values: [[fields.name]] })
  if (fields.phone         !== undefined) data.push({ range: `Riders!C${row}`, values: [[fields.phone]] })
  if (fields.email         !== undefined) data.push({ range: `Riders!D${row}`, values: [[fields.email]] })
  if (fields.active        !== undefined) data.push({ range: `Riders!E${row}`, values: [[fields.active ? 'TRUE' : 'FALSE']] })
  if (fields.weeklyHours   !== undefined) data.push({ range: `Riders!F${row}`, values: [[String(fields.weeklyHours)]] })
  if (fields.cancellations !== undefined) data.push({ range: `Riders!G${row}`, values: [[String(fields.cancellations)]] })
  if (!data.length) return
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  })
}

// ═══════════════════════════════════════════════════════════
// SHIFTS
// Sheet "Shifts" A–J:
// ShiftID | Date | Day | Start | End | Hours | Capacity | Booked | Status | Notes
// ═══════════════════════════════════════════════════════════

export async function getShifts() {
  try {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Shifts!A2:J',
  })
  return (res.data.values || []).map(r => ({
    id:       (r[0] || '').trim(),
    date:     (r[1] || '').trim(),   // YYYY-MM-DD (internal)
    day:      (r[2] || '').trim(),
    start:    (r[3] || '').trim(),   // HH:mm
    end:      (r[4] || '').trim(),   // HH:mm
    hours:    parseFloat(r[5] || '0'),
    capacity: parseInt(r[6] || '5'),
    booked:   parseInt(r[7] || '0'),
    status:   (r[8] || 'OPEN').trim(),
    notes:    (r[9] || '').trim(),
  })).filter(s => s.id)
  } catch (e: any) {
    throw new Error(`[getShifts] Google Sheets error: ${e.message}`)
  }
}

export async function addShiftToSheet(shift: {
  id: string; date: string; day: string; start: string
  end: string; hours: number; capacity: number; notes: string
}) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Shifts!A:J',
    valueInputOption: 'RAW',
    requestBody: { values: [[
      shift.id, shift.date, shift.day,
      toHHMM(shift.start), toHHMM(shift.end),
      shift.hours, shift.capacity, 0, 'OPEN', shift.notes,
    ]] },
  })
}

export async function updateShiftInSheet(id: string, fields: {
  booked?: number; status?: string; capacity?: number
  start?: string; end?: string; notes?: string
}) {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:J' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === id)
  if (idx === -1) {
    console.warn(`[updateShiftInSheet] Shift ${id} not found`)
    return
  }
  const row  = idx + 2
  const data: { range: string; values: any[][] }[] = []
  if (fields.start    !== undefined) data.push({ range: `Shifts!D${row}`, values: [[toHHMM(fields.start)]] })
  if (fields.end      !== undefined) data.push({ range: `Shifts!E${row}`, values: [[toHHMM(fields.end)]] })
  if (fields.capacity !== undefined) data.push({ range: `Shifts!G${row}`, values: [[String(fields.capacity)]] })
  if (fields.booked   !== undefined) data.push({ range: `Shifts!H${row}`, values: [[String(fields.booked)]] })
  if (fields.status   !== undefined) data.push({ range: `Shifts!I${row}`, values: [[fields.status]] })
  if (fields.notes    !== undefined) data.push({ range: `Shifts!J${row}`, values: [[fields.notes]] })
  if (!data.length) return
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: { valueInputOption: 'RAW', data },
  })
}

export async function deleteShiftFromSheet(id: string) {
  const res  = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:J' })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID, range: `Shifts!A${idx+2}:J${idx+2}`,
  })
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS — read
// ═══════════════════════════════════════════════════════════

export async function getBookings(): Promise<BookingRow[]> {
  try {
    const res = await sheets().spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: 'Bookings!A2:M',   // 13 cols A–M
    })
    return (res.data.values || [])
      .map(r => normalizeBookingRow(r as string[]))
      .filter(b => b.id)                                  // skip blank rows
  } catch (e: any) {
    throw new Error(`[getBookings] Google Sheets error: ${e.message}`)
  }
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS — write new booking row (13 columns, strict order)
// ═══════════════════════════════════════════════════════════

export async function addBookingToSheet(params: {
  id:        string
  riderNb:   string
  riderName: string
  shift: {
    id:    string
    date:  string   // YYYY-MM-DD from Shifts sheet
    day:   string
    start: string   // HH:mm
    end:   string   // HH:mm
    hours: number
  }
}) {
  const { id, riderNb, riderName, shift } = params
  const now = new Date()
  const ts  = toEuroDateTime(now)   // DD.MM.YYYY HH:mm — never ISO

  // Validate before writing — catch any bad data early
  const shiftDateEuro = toEuroDate(shift.date)
  const startHHMM     = toHHMM(shift.start)
  const endHHMM       = toHHMM(shift.end)
  const hoursNum      = Number(shift.hours)

  if (!id || !riderNb || !shift.id) {
    throw new Error(`addBookingToSheet: missing required fields id=${id} riderNb=${riderNb} shiftId=${shift.id}`)
  }
  if (!shiftDateEuro || !/^\d{2}\.\d{2}\.\d{4}$/.test(shiftDateEuro)) {
    throw new Error(`addBookingToSheet: invalid date "${shift.date}" → "${shiftDateEuro}"`)
  }
  if (!startHHMM || !endHHMM) {
    throw new Error(`addBookingToSheet: invalid time start="${shift.start}" end="${shift.end}"`)
  }

  // Build the row in EXACT column order A–M
  const row = [
    id,            // A  Booking_ID
    riderNb,       // B  MB_No
    riderName,     // C  Rider_Name
    shift.id,      // D  Shift_ID
    shiftDateEuro, // E  Shift_Date    DD.MM.YYYY
    shift.day,     // F  Day
    startHHMM,     // G  Start_Time    HH:mm
    endHHMM,       // H  End_Time      HH:mm
    hoursNum,      // I  Hours         numeric
    'Confirmed',   // J  Status
    '',            // K  Cancel_Reason (empty)
    ts,            // L  Created_At    DD.MM.YYYY HH:mm
    ts,            // M  Updated_At    same as Created_At on creation
  ]

  console.log(`[addBookingToSheet] Writing ${id} for ${riderNb} | shift ${shift.id} | ${shiftDateEuro} ${startHHMM}–${endHHMM} | ${hoursNum}h`)

  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Bookings!A:M',
    valueInputOption: 'RAW',
    requestBody: { values: [row] },
  })
}

// ═══════════════════════════════════════════════════════════
// BOOKINGS — cancel (update existing row, never create new one)
// ═══════════════════════════════════════════════════════════

export async function cancelBookingInSheet(bookingId: string, reason: string): Promise<void> {
  const res  = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Bookings!A2:M',
  })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => (r[0] || '').trim() === bookingId)
  if (idx === -1) {
    console.warn(`[cancelBookingInSheet] Booking ${bookingId} not found`)
    return
  }
  const row = idx + 2
  const ts  = toEuroDateTime(new Date())

  console.log(`[cancelBookingInSheet] Cancelling row ${row} (${bookingId}) reason="${reason}"`)

  // Update Status (col J = index 9, row col J), Cancel_Reason (K), Updated_At (M)
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `Bookings!J${row}`, values: [['Cancelled']] },
        { range: `Bookings!K${row}`, values: [[reason]] },
        { range: `Bookings!M${row}`, values: [[ts]] },
      ],
    },
  })
}

// ═══════════════════════════════════════════════════════════
// HEADERS — write correct 13-column headers to row 1
// ═══════════════════════════════════════════════════════════

export async function ensureBookingsHeaders(): Promise<void> {
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: 'Bookings!A1:M1',
    valueInputOption: 'RAW',
    requestBody: { values: [BOOKING_HEADERS] },
  })
  console.log('[ensureBookingsHeaders] Headers written:', BOOKING_HEADERS.join(' | '))
}
