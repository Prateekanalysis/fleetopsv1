import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRider, getTokenPayload } from '../../../lib/auth'
import { getBookings, addBookingToSheet, cancelBookingInSheet, getShifts, updateShiftInSheet, getRiders, updateRiderInSheet } from '../../../lib/sheets'

const WEEKLY_HOUR_LIMIT = 56
const DAILY_HOUR_LIMIT = 8

function getWeekRange() {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((day + 6) % 7))
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { monday, sunday }
}

function isThisWeek(dateStr: string) {
  const { monday, sunday } = getWeekRange()
  const d = new Date(dateStr)
  return d >= monday && d <= sunday
}

function isToday(dateStr: string) {
  const today = new Date().toISOString().split('T')[0]
  return dateStr === today
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  // GET — admin gets all, rider gets own
  if (req.method === 'GET') {
    const payload = getTokenPayload(req)
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const bookings = await getBookings()
      if (payload.role === 'rider') return res.status(200).json(bookings.filter(b => b.riderNb === payload.nb))
      return res.status(200).json(bookings)
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch bookings: ' + e.message })
    }
  }

  // POST — rider books a shift
  if (req.method === 'POST') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { shiftId } = req.body
    if (!shiftId) return res.status(400).json({ error: 'shiftId required' })

    try {
      const [shifts, bookings] = await Promise.all([getShifts(), getBookings()])
      const shift = shifts.find(s => s.id === shiftId)
      if (!shift) return res.status(404).json({ error: 'Shift not found' })
      if (shift.booked >= shift.capacity) return res.status(400).json({ error: 'This shift is full' })

      // Already booked this shift?
      const already = bookings.find(b => b.riderNb === rider.nb && b.shiftId === shiftId && b.status === 'Confirmed')
      if (already) return res.status(400).json({ error: 'You already booked this shift' })

      // Get all confirmed bookings for this rider with shift details
      const myConfirmed = bookings.filter(b => b.riderNb === rider.nb && b.status === 'Confirmed')
      const myShifts = myConfirmed.map(b => shifts.find(s => s.id === b.shiftId)).filter(Boolean) as typeof shifts

      // ── DAILY LIMIT: max 8h per day ──
      const dailyShifts = myShifts.filter(s => s.date === shift.date)
      const dailyHours = dailyShifts.reduce((sum, s) => sum + s.hours, 0)
      if (dailyHours + shift.hours > DAILY_HOUR_LIMIT) {
        const remaining = Math.max(0, DAILY_HOUR_LIMIT - dailyHours)
        return res.status(400).json({
          error: `Daily limit reached. You have ${remaining}h left for ${shift.date} (max ${DAILY_HOUR_LIMIT}h/day).`
        })
      }

      // ── WEEKLY LIMIT: max 56h per week ──
      const weeklyShifts = myShifts.filter(s => isThisWeek(s.date))
      const weeklyHours = weeklyShifts.reduce((sum, s) => sum + s.hours, 0)
      if (weeklyHours + shift.hours > WEEKLY_HOUR_LIMIT) {
        const remaining = Math.max(0, WEEKLY_HOUR_LIMIT - weeklyHours)
        return res.status(400).json({
          error: `Weekly limit reached. You have ${remaining}h left this week (max ${WEEKLY_HOUR_LIMIT}h/week).`
        })
      }

      const id = `BK${String(bookings.length + 1).padStart(3, '0')}`
      const newBooked = shift.booked + 1

      // Update weekly hours on rider
      const newWeeklyHours = parseFloat((weeklyHours + shift.hours).toFixed(1))

      await Promise.all([
        addBookingToSheet({ id, riderNb: rider.nb, shiftId }),
        updateShiftInSheet(shiftId, { booked: newBooked, status: newBooked >= shift.capacity ? 'FULL' : 'OPEN' }),
        updateRiderInSheet(rider.nb, { weeklyHours: newWeeklyHours }),
      ])

      return res.status(201).json({
        ok: true,
        bookingId: id,
        weeklyHours: newWeeklyHours,
        weeklyRemaining: parseFloat((WEEKLY_HOUR_LIMIT - newWeeklyHours).toFixed(1))
      })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to book shift: ' + e.message })
    }
  }

  // PATCH — rider cancels a booking
  if (req.method === 'PATCH') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { bookingId, reason } = req.body
    if (!bookingId || !reason) return res.status(400).json({ error: 'bookingId and reason required' })

    try {
      const [bookings, riders, shifts] = await Promise.all([getBookings(), getRiders(), getShifts()])
      const booking = bookings.find(b => b.id === bookingId && b.riderNb === rider.nb)
      if (!booking) return res.status(404).json({ error: 'Booking not found' })
      if (booking.status === 'Cancelled') return res.status(400).json({ error: 'Already cancelled' })

      const riderData = riders.find(r => r.nb === rider.nb)
      if ((riderData?.cancellations || 0) >= 5) {
        return res.status(400).json({ error: 'Weekly cancellation limit reached (5/5). Contact your admin.' })
      }

      const shift = shifts.find(s => s.id === booking.shiftId)
      const newBooked = Math.max(0, (shift?.booked || 1) - 1)

      // Subtract hours back from weekly total
      const currentHours = riderData?.weeklyHours || 0
      const newWeeklyHours = Math.max(0, parseFloat((currentHours - (shift?.hours || 0)).toFixed(1)))

      await Promise.all([
        cancelBookingInSheet(bookingId, reason),
        shift ? updateShiftInSheet(booking.shiftId, { booked: newBooked, status: 'OPEN' }) : Promise.resolve(),
        updateRiderInSheet(rider.nb, {
          cancellations: (riderData?.cancellations || 0) + 1,
          weeklyHours: newWeeklyHours
        }),
      ])

      return res.status(200).json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to cancel booking: ' + e.message })
    }
  }

  res.status(405).end()
}
