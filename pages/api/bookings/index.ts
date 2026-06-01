import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRider, getTokenPayload } from '../../../lib/auth'
import { getBookings, addBookingToSheet, cancelBookingInSheet, getShifts, updateShiftInSheet, getRiders, updateRiderInSheet } from '../../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      const already = bookings.find(b => b.riderNb === rider.nb && b.shiftId === shiftId && b.status === 'Confirmed')
      if (already) return res.status(400).json({ error: 'You already booked this shift' })
      const id = `BK${String(bookings.length + 1).padStart(3, '0')}`
      const newBooked = shift.booked + 1
      await Promise.all([
        addBookingToSheet({ id, riderNb: rider.nb, shiftId }),
        updateShiftInSheet(shiftId, { booked: newBooked, status: newBooked >= shift.capacity ? 'FULL' : 'OPEN' }),
      ])
      return res.status(201).json({ ok: true, bookingId: id })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to book shift: ' + e.message })
    }
  }

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
      await Promise.all([
        cancelBookingInSheet(bookingId, reason),
        shift ? updateShiftInSheet(booking.shiftId, { booked: newBooked, status: 'OPEN' }) : Promise.resolve(),
        updateRiderInSheet(rider.nb, { cancellations: (riderData?.cancellations || 0) + 1 }),
      ])
      return res.status(200).json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to cancel booking: ' + e.message })
    }
  }

  res.status(405).end()
}
