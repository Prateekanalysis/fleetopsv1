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

// ── DATE/TIME HELPERS ─────────────────────────────────────

/** "2026-06-01" → "01.06.2026" */
export function toEuroDate(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  // already DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) return s
  // YYYY-MM-DD or YYYY-MM-DDT...
  const iso = s.slice(0, 10)
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return s
  return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`
}

/** Date object → "01.06.2026 14:30" */
export function toEuroDateTime(date: Date): string {
  const d  = String(date.getDate()).padStart(2,'0')
  const m  = String(date.getMonth()+1).padStart(2,'0')
  const y  = date.getFullYear()
  const hh = String(date.getHours()).padStart(2,'0')
  const mm = String(date.getMinutes()).padStart(2,'0')
  return `${d}.${m}.${y} ${hh}:${mm}`
}

/** Any time string → "HH:mm"  (handles "09:00", "9:00", ISO timestamps) */
export function toHHMM(t: string): string {
  if (!t) return ''
  if (t.includes('T')) {
    const d = new Date(t)
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }
  const parts = t.trim().split(':')
  return `${String(parseInt(parts[0])).padStart(2,'0')}:${(parts[1]||'00').slice(0,2)}`
}

// ─── RIDERS ───────────────────────────────────────────────
// Sheet "Riders" columns (A–G):
// NB_Number | Name | Phone | Email | Active | Weekly_Hours | Cancellations

export async function getRiders() {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Riders!A2:G',
  })
  return (res.data.values || []).map(r => ({
    nb:            r[0] || '',
    name:          r[1] || '',
    phone:         r[2] || '',
    email:         r[3] || '',
    active:        (r[4] || 'TRUE').toUpperCase() === 'TRUE',
    weeklyHours:   parseFloat(r[5] || '0'),
    cancellations: parseInt(r[6]   || '0'),
  })).filter(r => r.nb)
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
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Riders!A2:G',
  })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === nb)
  if (idx === -1) return
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

// ─── SHIFTS ───────────────────────────────────────────────
// Sheet "Shifts" columns (A–J):
// ShiftID | Date | Day | Start | End | Hours | Capacity | Booked | Status | Notes

export async function getShifts() {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Shifts!A2:J',
  })
  return (res.data.values || []).map(r => ({
    id:       r[0] || '',
    date:     r[1] || '',   // YYYY-MM-DD
    day:      r[2] || '',
    start:    r[3] || '',   // HH:mm
    end:      r[4] || '',   // HH:mm
    hours:    parseFloat(r[5] || '0'),
    capacity: parseInt(r[6]   || '5'),
    booked:   parseInt(r[7]   || '0'),
    status:   r[8] || 'OPEN',
    notes:    r[9] || '',
  })).filter(s => s.id)
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
  const res  = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Shifts!A2:J',
  })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
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
  const res  = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Shifts!A2:J',
  })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `Shifts!A${idx+2}:J${idx+2}`,
  })
}

// ─── BOOKINGS ─────────────────────────────────────────────
// Sheet "Bookings" columns (A–J) — 10 columns:
// Booking_ID | Rider_NB | Shift_ID | Date | Start | End | Hours | Status | Cancel_Reason | Timestamp
//
// Date      → DD.MM.YYYY   (pulled from Shifts sheet at booking time)
// Start/End → HH:mm        (pulled from Shifts sheet at booking time)
// Hours     → number       (pulled from Shifts sheet at booking time)
// Timestamp → DD.MM.YYYY HH:mm

export interface BookingRow {
  id:           string   // Booking_ID
  riderNb:      string   // Rider_NB
  shiftId:      string   // Shift_ID
  date:         string   // DD.MM.YYYY (from sheet) or YYYY-MM-DD (from Shifts)
  start:        string   // HH:mm
  end:          string   // HH:mm
  hours:        number
  status:       string   // Confirmed | Cancelled
  cancelReason: string
  timestamp:    string   // DD.MM.YYYY HH:mm
}

export async function getBookings(): Promise<BookingRow[]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Bookings!A2:J',
  })
  return (res.data.values || []).map(r => ({
    id:           r[0] || '',
    riderNb:      r[1] || '',
    shiftId:      r[2] || '',
    date:         r[3] || '',
    start:        r[4] || '',
    end:          r[5] || '',
    hours:        parseFloat(r[6] || '0'),
    status:       r[7] || 'Confirmed',
    cancelReason: r[8] || '',
    timestamp:    r[9] || '',
  })).filter(b => b.id)
}

/**
 * Write a new booking row — pulling Date, Start, End, Hours from the shift object
 * so the Bookings sheet is always complete and never needs a join.
 */
export async function addBookingToSheet(params: {
  id:      string
  riderNb: string
  shift:   { id: string; date: string; start: string; end: string; hours: number }
}) {
  const { id, riderNb, shift } = params
  const now = new Date()
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID, range: 'Bookings!A:J',
    valueInputOption: 'RAW',
    requestBody: { values: [[
      id,                       // A: Booking_ID
      riderNb,                  // B: Rider_NB
      shift.id,                 // C: Shift_ID
      toEuroDate(shift.date),   // D: Date       → DD.MM.YYYY
      toHHMM(shift.start),      // E: Start      → HH:mm
      toHHMM(shift.end),        // F: End        → HH:mm
      shift.hours,              // G: Hours
      'Confirmed',              // H: Status
      '',                       // I: Cancel_Reason (blank on booking)
      toEuroDateTime(now),      // J: Timestamp  → DD.MM.YYYY HH:mm
    ]] },
  })
}

/**
 * Cancel a booking — updates Status (col H) and Cancel_Reason (col I).
 * Also decrements Booked in Shifts sheet immediately.
 */
export async function cancelBookingInSheet(bookingId: string, reason: string) {
  const res  = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID, range: 'Bookings!A2:J',
  })
  const rows = res.data.values || []
  const idx  = rows.findIndex(r => r[0] === bookingId)
  if (idx === -1) return
  const row  = idx + 2
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `Bookings!H${row}`, values: [['Cancelled']] },
        { range: `Bookings!I${row}`, values: [[reason]] },
      ],
    },
  })
}

// ── WRITE HEADERS ─────────────────────────────────────────
/** Call once after deploy: GET /api/setup-headers (admin only) */
export async function ensureBookingsHeaders() {
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID, range: 'Bookings!A1:J1',
    valueInputOption: 'RAW',
    requestBody: { values: [[
      'Booking_ID', 'Rider_NB', 'Shift_ID',
      'Date', 'Start', 'End', 'Hours',
      'Status', 'Cancel_Reason', 'Timestamp',
    ]] },
  })
}
