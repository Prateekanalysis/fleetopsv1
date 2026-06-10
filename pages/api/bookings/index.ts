import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRider, getTokenPayload } from '../../../lib/auth'
import {
  getBookings, addBookingToSheet, cancelBookingInSheet,
  getShifts, updateShiftInSheet,
  getRiders, updateRiderInSheet,
  toISODate,
} from '../../../lib/sheets'

const WEEKLY_LIMIT = 56
const DAILY_LIMIT  = 8
const CANCEL_WEEKLY_LIMIT = 5

// ── Week bounds: Monday 00:00 → Sunday 23:59 (local server time) ──
function getWeekBounds() {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  mon.setHours(0, 0, 0, 0)
  const sun = new Date(mon)
  sun.setDate(mon.getDate() + 6)
  sun.setHours(23, 59, 59, 999)
  return { mon, sun }
}

/** Today as YYYY-MM-DD using local server time (not UTC) */
function todayLocalISO(): string {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Is shiftDate (any supported format) inside current Mon–Sun week? */
function isThisWeek(shiftDate: string): boolean {
  const iso = toISODate(shiftDate)
  if (!iso) return false
  const d = new Date(iso + 'T00:00:00')
  if (isNaN(d.getTime())) return false
  const { mon, sun } = getWeekBounds()
  return d >= mon && d <= sun
}

/** Is shiftDate inside the current Mon–Sun week? (alias, same logic) */
function isCancelThisWeek(shiftDate: string): boolean {
  return isThisWeek(shiftDate)
}

/** Do two shifts overlap? [s1start, s1end) overlaps [s2start, s2end) */
function toMins(t: string): number {
  const parts = (t || '00:00').split(':').map(Number)
  return (parts[0] || 0) * 60 + (parts[1] || 0)
}
function shiftsOverlap(
  a: { start: string; end: string },
  b: { start: string; end: string }
): boolean {
  const as = toMins(a.start), ae = toMins(a.end)
  const bs = toMins(b.start), be = toMins(b.end)
  return as < be && ae > bs
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  // ── GET ────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const payload = getTokenPayload(req)
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const bookings = await getBookings()
      if (payload.role === 'rider') {
        return res.status(200).json(bookings.filter(b => b.riderNb === payload.nb))
      }
      return res.status(200).json(bookings)
    } catch (e: any) {
      console.error('[GET /api/bookings]', e.message)
      return res.status(500).json({ error: 'Failed to fetch bookings: ' + e.message })
    }
  }

  // ── POST — rider books a shift ─────────────────────────────
  if (req.method === 'POST') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { shiftId } = req.body
    if (!shiftId) return res.status(400).json({ error: 'shiftId required' })

    try {
      const [shifts, bookings, riders] = await Promise.all([
        getShifts(), getBookings(), getRiders(),
      ])

      // 1. Validate shift exists and has capacity
      const shift = shifts.find(s => s.id === shiftId)
      if (!shift) {
        return res.status(404).json({ error: `Shift ${shiftId} not found. It may have been deleted.` })
      }
      if (shift.booked >= shift.capacity) {
        return res.status(400).json({ error: 'This shift is full. Please choose another.' })
      }

      // 2. Duplicate guard (same shift, same rider, Confirmed)
      const already = bookings.find(
        b => b.riderNb === rider.nb && b.shiftId === shiftId && b.status === 'Confirmed'
      )
      if (already) {
        return res.status(400).json({ error: `You already have shift ${shiftId} booked (${already.id}).` })
      }

      // 3. Overlapping shift guard
      // Find all confirmed bookings for this rider on the same date
      const shiftDateISO = toISODate(shift.date)
      const myConfirmed  = bookings.filter(b => b.riderNb === rider.nb && b.status === 'Confirmed')
      const sameDayConfirmed = myConfirmed.filter(b => {
        const bkShift = shifts.find(s => s.id === b.shiftId)
        const bkDate  = bkShift ? toISODate(bkShift.date) : toISODate(b.shiftDate)
        return bkDate === shiftDateISO
      })
      for (const bk of sameDayConfirmed) {
        const bkShift = shifts.find(s => s.id === bk.shiftId)
        const bkStart = bkShift?.start || bk.startTime
        const bkEnd   = bkShift?.end   || bk.endTime
        if (bkStart && bkEnd && shiftsOverlap(shift, { start: bkStart, end: bkEnd })) {
          return res.status(400).json({
            error: `This shift overlaps with your existing booking ${bk.shiftId} (${bkStart}–${bkEnd}).`,
          })
        }
      }

      // 4. Hour limits — calculated from Shift_Date, NOT booking timestamp
      let dailyHours  = 0
      let weeklyHours = 0
      for (const bk of myConfirmed) {
        const bkShift   = shifts.find(s => s.id === bk.shiftId)
        const bkDateISO = bkShift ? toISODate(bkShift.date) : toISODate(bk.shiftDate)
        const bkHours   = bkShift ? bkShift.hours : bk.hours
        if (!bkDateISO || !bkHours) continue
        if (bkDateISO === shiftDateISO) dailyHours  += bkHours
        if (isThisWeek(bkDateISO))      weeklyHours += bkHours
      }

      console.log(`[POST /api/bookings] ${rider.nb} | daily=${dailyHours}h weekly=${weeklyHours}h | booking ${shift.hours}h on ${shift.date}`)

      if (dailyHours + shift.hours > DAILY_LIMIT) {
        const left = +(DAILY_LIMIT - dailyHours).toFixed(1)
        return res.status(400).json({
          error: `Daily limit: ${left}h remaining today (max ${DAILY_LIMIT}h/day).`,
        })
      }
      if (weeklyHours + shift.hours > WEEKLY_LIMIT) {
        const left = +(WEEKLY_LIMIT - weeklyHours).toFixed(1)
        return res.status(400).json({
          error: `Weekly limit: ${left}h remaining this week (max ${WEEKLY_LIMIT}h/week).`,
        })
      }

      // 5. Generate unique booking ID (max existing + 1, handles deletions)
      const maxNum = bookings.reduce((max, b) => {
        const n = parseInt(b.id.replace(/\D/g, '')) || 0
        return n > max ? n : max
      }, 0)
      const id        = `BK${String(maxNum + 1).padStart(3, '0')}`
      const newBooked = shift.booked + 1
      const newWeekly = +(weeklyHours + shift.hours).toFixed(1)

      const riderData = riders.find(r => r.nb === rider.nb)
      const riderName = riderData?.name || rider.nb

      await Promise.all([
        addBookingToSheet({ id, riderNb: rider.nb, riderName, shift: {
          id: shift.id, date: shift.date, day: shift.day,
          start: shift.start, end: shift.end, hours: shift.hours,
        }}),
        updateShiftInSheet(shiftId, {
          booked: newBooked,
          status: newBooked >= shift.capacity ? 'FULL' : 'OPEN',
        }),
        updateRiderInSheet(rider.nb, { weeklyHours: newWeekly }),
      ])

      console.log(`[POST /api/bookings] Created ${id} | weeklyHours=${newWeekly}h`)

      return res.status(201).json({
        ok:              true,
        bookingId:       id,
        weeklyHours:     newWeekly,
        weeklyRemaining: +(WEEKLY_LIMIT - newWeekly).toFixed(1),
      })
    } catch (e: any) {
      console.error('[POST /api/bookings]', e.message)
      return res.status(500).json({ error: 'Booking failed: ' + e.message })
    }
  }

  // ── PATCH — rider cancels ──────────────────────────────────
  if (req.method === 'PATCH') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { bookingId, reason } = req.body
    if (!bookingId || !reason) {
      return res.status(400).json({ error: 'bookingId and reason are required' })
    }

    try {
      const [bookings, riders, shifts] = await Promise.all([
        getBookings(), getRiders(), getShifts(),
      ])

      const booking = bookings.find(b => b.id === bookingId && b.riderNb === rider.nb)
      if (!booking) return res.status(404).json({ error: 'Booking not found' })
      if (booking.status === 'Cancelled') return res.status(400).json({ error: 'Already cancelled' })

      // Weekly cancellation count — only count cancellations THIS week
      const weeklyCancels = bookings.filter(b => {
        if (b.riderNb !== rider.nb || b.status !== 'Cancelled') return false
        // Use shiftDate (the shift's date) for weekly window
        return isThisWeek(b.shiftDate)
      }).length

      if (weeklyCancels >= CANCEL_WEEKLY_LIMIT) {
        return res.status(400).json({
          error: `Weekly cancellation limit reached (${CANCEL_WEEKLY_LIMIT}/${CANCEL_WEEKLY_LIMIT}). Contact your admin.`,
        })
      }

      const riderData = riders.find(r => r.nb === rider.nb)
      const shift     = shifts.find(s => s.id === booking.shiftId)
      const newBooked = Math.max(0, (shift?.booked ?? 1) - 1)

      // Recalculate weekly hours from remaining confirmed bookings (avoids drift)
      const remainingConfirmed = bookings.filter(
        b => b.riderNb === rider.nb && b.status === 'Confirmed' && b.id !== bookingId
      )
      let newWeekly = 0
      for (const bk of remainingConfirmed) {
        const bkShift   = shifts.find(s => s.id === bk.shiftId)
        const bkDateISO = bkShift ? toISODate(bkShift.date) : toISODate(bk.shiftDate)
        const bkHours   = bkShift ? bkShift.hours : bk.hours
        if (bkDateISO && isThisWeek(bkDateISO) && bkHours) newWeekly += bkHours
      }
      newWeekly = +newWeekly.toFixed(1)

      console.log(`[PATCH /api/bookings] Cancel ${bookingId} | weeklyCancels=${weeklyCancels}→${weeklyCancels+1} | newWeekly=${newWeekly}h`)

      await Promise.all([
        cancelBookingInSheet(bookingId, reason),
        shift ? updateShiftInSheet(booking.shiftId, { booked: newBooked, status: 'OPEN' }) : Promise.resolve(),
        updateRiderInSheet(rider.nb, {
          cancellations: weeklyCancels + 1,
          weeklyHours:   newWeekly,
        }),
      ])

      return res.status(200).json({
        ok:            true,
        weeklyHours:   newWeekly,
        weeklyCancels: weeklyCancels + 1,
      })
    } catch (e: any) {
      console.error('[PATCH /api/bookings]', e.message)
      return res.status(500).json({ error: 'Cancellation failed: ' + e.message })
    }
  }

  res.status(405).end()
}
