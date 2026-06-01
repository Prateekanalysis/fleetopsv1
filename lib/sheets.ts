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

// ─── RIDERS ──────────────────────────────────────────────
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

export async function updateRiderInSheet(nb: string, fields: { active?: boolean; weeklyHours?: number; cancellations?: number; name?: string; phone?: string; email?: string }) {
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
    date: r[1] || '',
    day: r[2] || '',
    start: r[3] || '',
    end: r[4] || '',
    hours: parseFloat(r[5] || '0'),
    capacity: parseInt(r[6] || '5'),
    booked: parseInt(r[7] || '0'),
    status: r[8] || 'OPEN',
    notes: r[9] || '',
  })).filter(s => s.id)
}

export async function addShiftToSheet(shift: { id: string; date: string; day: string; start: string; end: string; hours: number; capacity: number; notes: string }) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Shifts!A:J',
    valueInputOption: 'RAW',
    requestBody: { values: [[shift.id, shift.date, shift.day, shift.start, shift.end, shift.hours, shift.capacity, 0, 'OPEN', shift.notes]] },
  })
}

export async function updateShiftInSheet(id: string, fields: { booked?: number; status?: string; capacity?: number; start?: string; end?: string; notes?: string }) {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Shifts!A2:J' })
  const rows = res.data.values || []
  const idx = rows.findIndex(r => r[0] === id)
  if (idx === -1) return
  const row = idx + 2
  const data: { range: string; values: any[][] }[] = []
  if (fields.start !== undefined) data.push({ range: `Shifts!D${row}`, values: [[fields.start]] })
  if (fields.end !== undefined) data.push({ range: `Shifts!E${row}`, values: [[fields.end]] })
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
// Sheet "Bookings": BookingID | RiderNB | ShiftID | Status | CancelReason | CreatedAt

export async function getBookings() {
  const res = await sheets().spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A2:F',
  })
  return (res.data.values || []).map(r => ({
    id: r[0] || '',
    riderNb: r[1] || '',
    shiftId: r[2] || '',
    status: r[3] || 'Confirmed',
    cancelReason: r[4] || '',
    createdAt: r[5] || '',
  })).filter(b => b.id)
}

export async function addBookingToSheet(booking: { id: string; riderNb: string; shiftId: string }) {
  await sheets().spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: 'Bookings!A:F',
    valueInputOption: 'RAW',
    requestBody: { values: [[booking.id, booking.riderNb, booking.shiftId, 'Confirmed', '', new Date().toISOString()]] },
  })
}

export async function cancelBookingInSheet(bookingId: string, reason: string) {
  const res = await sheets().spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Bookings!A2:F' })
  const rows = res.data.values || []
  const idx = rows.findIndex(r => r[0] === bookingId)
  if (idx === -1) return
  const row = idx + 2
  await sheets().spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        { range: `Bookings!D${row}`, values: [['Cancelled']] },
        { range: `Bookings!E${row}`, values: [[reason]] },
      ],
    },
  })
}
