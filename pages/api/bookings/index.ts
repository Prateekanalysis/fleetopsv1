import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRider, getTokenPayload } from '../../../lib/auth'
import {
  getBookings, addBookingToSheet, cancelBookingInSheet,
  getShifts, updateShiftInSheet,
  getRiders, updateRiderInSheet,
} from '../../../lib/sheets'

const WEEKLY_LIMIT = 56
const DAILY_LIMIT  = 8

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

/**
 * Normalise any date string to "YYYY-MM-DD" for arithmetic.
 * Handles: "2026-06-01", "01.06.2026"
 */
function toISO(raw: string): string {
  if (!raw) return ''
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(s)) {
    const [d, m, y] = s.split('.')
    return `${y}-${m}-${d}`
  }
  return s
}

function isThisWeek(dateRaw: string): boolean {
  const { mon, sun } = getWeekBounds()
  const d = new Date(toISO(dateRaw) + 'T00:00:00')
  return d >= mon && d <= sun
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  // ── GET ───────────────────────────────────────────────────
  // No caching — always fresh from Sheets
  if (req.method === 'GET') {
    const payload = getTokenPayload(req)
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const bookings = await getBookings()
      if (payload.role === 'rider') {
        return res.status(200).json(bookings.filter(b => b.riderNb === payload.nb))
      }
      // admin gets everything
      return res.status(200).json(bookings)
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch bookings: ' + e.message })
    }
  }

  // ── POST — rider books a shift ────────────────────────────
  if (req.method === 'POST') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { shiftId } = req.body
    if (!shiftId) return res.status(400).json({ error: 'shiftId required' })

    try {
      // Fetch everything fresh — no stale cache
      const [shifts, bookings, riders] = await Promise.all([
        getShifts(), getBookings(), getRiders(),
      ])

      // ── Validate shift ──
      const shift = shifts.find(s => s.id === shiftId)
      if (!shift) return res.status(404).json({ error: `Shift ${shiftId} not found in Shifts sheet` })
      if (shift.booked >= shift.capacity) return res.status(400).json({ error: 'This shift is full' })

      // ── Duplicate booking guard ──
      const already = bookings.find(
        b => b.riderNb === rider.nb && b.shiftId === shiftId && b.status === 'Confirmed'
      )
      if (already) return res.status(400).json({ error: 'You already have this shift booked' })

      // ── Hour limits (cross-reference Shifts for actual hours) ──
      const myConfirmedShiftIds = bookings
        .filter(b => b.riderNb === rider.nb && b.status === 'Confirmed')
        .map(b => b.shiftId)
      const myConfirmedShifts = shifts.filter(s => myConfirmedShiftIds.includes(s.id))

      const shiftISO   = toISO(shift.date)
      const dailyHours = myConfirmedShifts
        .filter(s => toISO(s.date) === shiftISO)
        .reduce((a, s) => a + s.hours, 0)

      if (dailyHours + shift.hours > DAILY_LIMIT) {
        const left = +(DAILY_LIMIT - dailyHours).toFixed(1)
        return res.status(400).json({
          error: `Daily limit: only ${left}h left on ${shift.date} (max ${DAILY_LIMIT}h/day)`,
        })
      }

      const weeklyHours = myConfirmedShifts
        .filter(s => isThisWeek(s.date))
        .reduce((a, s) => a + s.hours, 0)

      if (weeklyHours + shift.hours > WEEKLY_LIMIT) {
        const left = +(WEEKLY_LIMIT - weeklyHours).toFixed(1)
        return res.status(400).json({
          error: `Weekly limit: only ${left}h left this week (max ${WEEKLY_LIMIT}h/week)`,
        })
      }

      // ── Generate booking ID (BK001 … BK999) ──
      const id       = `BK${String(bookings.length + 1).padStart(3, '0')}`
      const newBooked = shift.booked + 1
      const newWeekly = +(weeklyHours + shift.hours).toFixed(1)

      // ── Write to Sheets — all three operations in parallel ──
      await Promise.all([
        // 1. Append full booking row with shift details embedded
        addBookingToSheet({
          id,
          riderNb: rider.nb,
          shift: {
            id:    shift.id,
            date:  shift.date,   // sheets.ts converts to DD.MM.YYYY
            start: shift.start,  // sheets.ts ensures HH:mm
            end:   shift.end,
            hours: shift.hours,
          },
        }),
        // 2. Increment Booked counter + flip status if full
        updateShiftInSheet(shiftId, {
          booked: newBooked,
          status: newBooked >= shift.capacity ? 'FULL' : 'OPEN',
        }),
        // 3. Update rider weekly hours
        updateRiderInSheet(rider.nb, { weeklyHours: newWeekly }),
      ])

      return res.status(201).json({
        ok:              true,
        bookingId:       id,
        weeklyHours:     newWeekly,
        weeklyRemaining: +(WEEKLY_LIMIT - newWeekly).toFixed(1),
      })
    } catch (e: any) {
      console.error('POST /api/bookings error:', e)
      return res.status(500).json({ error: 'Failed to book shift: ' + e.message })
    }
  }

  // ── PATCH — rider cancels a booking ──────────────────────
  if (req.method === 'PATCH') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { bookingId, reason } = req.body
    if (!bookingId || !reason) {
      return res.status(400).json({ error: 'bookingId and reason required' })
    }

    try {
      const [bookings, riders, shifts] = await Promise.all([
        getBookings(), getRiders(), getShifts(),
      ])

      const booking = bookings.find(b => b.id === bookingId && b.riderNb === rider.nb)
      if (!booking) return res.status(404).json({ error: 'Booking not found' })
      if (booking.status === 'Cancelled') return res.status(400).json({ error: 'Already cancelled' })

      const riderData = riders.find(r => r.nb === rider.nb)
      if ((riderData?.cancellations || 0) >= 5) {
        return res.status(400).json({
          error: 'Weekly cancellation limit reached (5/5). Contact your admin.',
        })
      }

      // Find the shift to get hours and current booked count
      const shift      = shifts.find(s => s.id === booking.shiftId)
      const newBooked  = Math.max(0, (shift?.booked ?? 1) - 1)
      const hoursBack  = shift?.hours ?? booking.hours ?? 0
      const newWeekly  = Math.max(0, +((riderData?.weeklyHours ?? 0) - hoursBack).toFixed(1))

      // All three sheet writes in parallel for instant update
      await Promise.all([
        // 1. Mark booking Cancelled + set reason
        cancelBookingInSheet(bookingId, reason),
        // 2. Decrement Booked in Shifts sheet, reopen slot
        shift
          ? updateShiftInSheet(booking.shiftId, { booked: newBooked, status: 'OPEN' })
          : Promise.resolve(),
        // 3. Update rider: +1 cancellation, subtract hours
        updateRiderInSheet(rider.nb, {
          cancellations: (riderData?.cancellations ?? 0) + 1,
          weeklyHours:   newWeekly,
        }),
      ])

      return res.status(200).json({ ok: true })
    } catch (e: any) {
      console.error('PATCH /api/bookings error:', e)
      return res.status(500).json({ error: 'Failed to cancel booking: ' + e.message })
    }
  }

  res.status(405).end()
}
