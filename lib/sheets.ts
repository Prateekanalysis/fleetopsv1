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

// ── DATE/TIME HELPERS ──────────────────────────────────────
// Input:  ISO date string "2026-06-01"  →  Output: "01.06.2026"
export function toEuroDate(isoDate: string): string {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-')
  if (!y || !m || !d) return isoDate
  return `${d.padStart(2,'0')}.${m.padStart(2,'0')}.${y}`
}

// Input: Date object  →  "01.06.2026 14:30"
export function toEuroDateTime(date: Date): string {
  const d = String(date.getDate()).padStart(2,'0')
  const m = String(date.getMonth()+1).padStart(2,'0')
  const y = date.getFullYear()
  const h = String(date.getHours()).padStart(2,'0')
  const min = String(date.getMinutes()).padStart(2,'0')
  return `${d}.${m}.${y} ${h}:${min}`
}

// Input: "09:00"  →  "09:00"  (passthrough — already HH:mm)
export function toHHMM(timeStr: string): string {
  if (!timeStr) return ''
  // Handle ISO timestamp accidentally passed in
  if (timeStr.includes('T')) {
    const t = new Date(timeStr)
    return `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}`
  }
  // Already HH:mm
  return timeStr.slice(0, 5)
}

// ─── RIDERS ───────────────────────────────────────────────
// Sheet "Riders": NB Number | Name | Phone | Email | Active | Weekly Hours | Cancellations

export async function getRiders() {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Riders!A2:G',
  })
  return (res.data.values || []).map(r => ({
    nb: r[0] || '',
    name: r[1] || '',
    phone: r[2] || '',
    email: r[3] || '',
    active: (r[4] || 'TRUE').toUpperCase() === 'TRUE',
    weeklyHours: parseFloat(r[5] || '0'),
    cancellations: parseInt(r[6] || '0'),
  })).filter(r => r.nb)
}

export async function addRiderToSheet(rider: { nb: string; name: string; phone: string; email: string }) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Riders!A:G',
    valueInputOption: 'RAW',
    requestBody: { values: [[rider.nb, rider.name, rider.phone, rider.email, 'TRUE', '0', '0']] },
  })
}

export async function updateRiderInSheet(nb: string, fields: {
  active?: boolean; weeklyHours?: number; cancellations?: number
  name?: string; phone?: string; email?: string
}) {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Riders!A2:G' })
  const rows = res.data.values || []
  const idx = rows.findIndex(r => r[0] === nb)
  if (idx === -1) return
  const row = idx + 2
  const data: { range: string; values: any[][] }[] = []
  if (fields.name !== undefined) data.push({ range: `Riders!B${row}`, values: [[fields.name]] })
  if (fields.phone !== undefined) data.push({ range: `Riders!C${row}`, values: [[fields.phone]] })
  if (fields.email !== undefined) data.push({ range: `Riders!D${row}`, values: [[fields.email]] })
  if (fields.active !== undefined) data.push({ range: `Riders!E${row}`, values: [[fields.active ? 'TRUE' : 'FALSE']] })
  if (fields.weeklyHours !== undefined) data.push({ range: `Riders!F${row}`, values: [[String(fields.weeklyHours)]] })
  if (fields.cancellations !== undefined) data.push({ range: `Riders!G${row}`, values: [[String(fields.cancellations)]] })
  if (data.length) {
    await sheets().spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    })
  }
}

// ─── SHIFTS ───────────────────────────────────────────────
// Sheet "Shifts": ShiftID | Date | Day | Start | End | Hours | Capacity | Booked | Status | Notes

export async function getShifts() {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Shifts!A2:J',
  })
  return (res.data.values || []).map(r => ({
    id: r[0] || '',
    date: r[1] || '',       // stored as YYYY-MM-DD internally
    day: r[2] || '',
    start: r[3] || '',      // stored as HH:mm
    end: r[4] || '',        // stored as HH:mm
    hours: parseFloat(r[5] || '0'),
    capacity: parseInt(r[6] || '5'),
    booked: parseInt(r[7] || '0'),
    status: r[8] || 'OPEN',
    notes: r[9] || '',
  })).filter(s => s.id)
}

export async function addShiftToSheet(shift: {
  id: string; date: string; day: string; start: string
  end: string; hours: number; capacity: number; notes: string
}) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Shifts!A:J',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        shift.id, shift.date, shift.day,
        toHHMM(shift.start), toHHMM(shift.end),
        shift.hours, shift.capacity, 0, 'OPEN', shift.notes
      ]]
    },
  })
}

export async function updateShiftInSheet(id: string, fields: {
  booked?: number; status?: string; capacity?: number
  start?: string; end?: string; notes?: string
}) {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:J' })
  const rows = res.data.values || []
  const idx = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
  const row = idx + 2
  const data: { range: string; values: any[][] }[] = []
  if (fields.start !== undefined) data.push({ range: `Shifts!D${row}`, values: [[toHHMM(fields.start)]] })
  if (fields.end !== undefined) data.push({ range: `Shifts!E${row}`, values: [[toHHMM(fields.end)]] })
  if (fields.capacity !== undefined) data.push({ range: `Shifts!G${row}`, values: [[String(fields.capacity)]] })
  if (fields.booked !== undefined) data.push({ range: `Shifts!H${row}`, values: [[String(fields.booked)]] })
  if (fields.status !== undefined) data.push({ range: `Shifts!I${row}`, values: [[fields.status]] })
  if (fields.notes !== undefined) data.push({ range: `Shifts!J${row}`, values: [[fields.notes]] })
  if (data.length) {
    await sheets().spreadsheets.values.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: { valueInputOption: 'RAW', data },
    })
  }
}

export async function deleteShiftFromSheet(id: string) {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:J' })
  const rows = res.data.values || []
  const idx = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
  await sheets().spreadsheets.values.clear({
    spreadsheetId: SHEET_ID,
    range: `Shifts!A${idx + 2}:J${idx + 2}`,
  })
}

// ─── BOOKINGS ─────────────────────────────────────────────
// Sheet "Bookings" NEW format (12 columns):
// Booking_ID | Rider_NB | Rider_Name | Shift_ID | Date | Day | Start_Time | End_Time | Hours | Status | Cancel_Reason | Booked_At

export interface BookingRow {
  id: string
  riderNb: string
  riderName: string
  shiftId: string
  date: string        // stored as YYYY-MM-DD (internal), displayed as DD.MM.YYYY
  day: string
  startTime: string   // HH:mm
  endTime: string     // HH:mm
  hours: number
  status: string
  cancelReason: string
  bookedAt: string    // DD.MM.YYYY HH:mm
}

export async function getBookings(): Promise<BookingRow[]> {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A2:L',
  })
  return (res.data.values || []).map(r => ({
    id: r[0] || '',
    riderNb: r[1] || '',
    riderName: r[2] || '',
    shiftId: r[3] || '',
    date: r[4] || '',       // may be "DD.MM.YYYY" from sheet or "YYYY-MM-DD" internal
    day: r[5] || '',
    startTime: r[6] || '',
    endTime: r[7] || '',
    hours: parseFloat(r[8] || '0'),
    status: r[9] || 'Confirmed',
    cancelReason: r[10] || '',
    bookedAt: r[11] || '',
  })).filter(b => b.id)
}

export async function addBookingToSheet(params: {
  id: string
  riderNb: string
  riderName: string
  shift: { id: string; date: string; day: string; start: string; end: string; hours: number }
}) {
  const { id, riderNb, riderName, shift } = params
  const now = new Date()
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A:L',
    valueInputOption: 'RAW',
    requestBody: {
      values: [[
        id,                          // A: Booking_ID
        riderNb,                     // B: Rider_NB
        riderName,                   // C: Rider_Name
        shift.id,                    // D: Shift_ID
        toEuroDate(shift.date),      // E: Date  → DD.MM.YYYY
        shift.day,                   // F: Day
        toHHMM(shift.start),         // G: Start_Time → HH:mm
        toHHMM(shift.end),           // H: End_Time   → HH:mm
        shift.hours,                 // I: Hours
        'Confirmed',                 // J: Status
        '',                          // K: Cancel_Reason (empty on booking)
        toEuroDateTime(now),         // L: Booked_At → DD.MM.YYYY HH:mm
      ]]
    },
  })
}

export async function cancelBookingInSheet(bookingId: string, reason: string) {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Bookings!A2:L' })
  const rows = res.data.values || []
  const idx = rows.findIndex(r => r[0] === bookingId)
  if (idx === -1) return
  const row = idx + 2
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `Bookings!J${row}`, values: [['Cancelled']] },
        { range: `Bookings!K${row}`, values: [[reason]] },
      ],
    },
  })
}

// ── GOOGLE SHEETS HEADERS SETUP ───────────────────────────
// Call once to write correct headers to Bookings sheet
export async function ensureBookingsHeaders() {
  const headers = [
    'Booking_ID', 'Rider_NB', 'Rider_Name', 'Shift_ID',
    'Date', 'Day', 'Start_Time', 'End_Time', 'Hours',
    'Status', 'Cancel_Reason', 'Booked_At'
  ]
  await sheets().spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A1:L1',
    valueInputOption: 'RAW',
    requestBody: { values: [headers] },
  })
}
