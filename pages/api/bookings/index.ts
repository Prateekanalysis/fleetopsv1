import type { NextApiRequest, NextApiResponse } from 'next'
import { requireRider, getTokenPayload } from '../../../lib/auth'
import {
  getBookings, addBookingToSheet, cancelBookingInSheet,
  getShifts, updateShiftInSheet,
  getRiders, updateRiderInSheet,
  toISODate, normalizeCity,
} from '../../../lib/sheets'

const WEEKLY_LIMIT       = 56
const DAILY_LIMIT        = 8
const CANCEL_WEEKLY_LIMIT = 5

function getWeekBounds() {
  const now = new Date()
  const mon = new Date(now)
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7))
  mon.setHours(0,0,0,0)
  const sun = new Date(mon); sun.setDate(mon.getDate()+6); sun.setHours(23,59,59,999)
  return { mon, sun }
}

function isThisWeek(shiftDate: string): boolean {
  const iso = toISODate(shiftDate)
  if (!iso) return false
  const d = new Date(iso+'T00:00:00')
  if (isNaN(d.getTime())) return false
  const { mon, sun } = getWeekBounds()
  return d >= mon && d <= sun
}

function toMins(t: string): number {
  const p = (t||'00:00').split(':').map(Number)
  return (p[0]||0)*60 + (p[1]||0)
}
function shiftsOverlap(a:{start:string;end:string}, b:{start:string;end:string}) {
  return toMins(a.start) < toMins(b.end) && toMins(a.end) > toMins(b.start)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  if (req.method === 'GET') {
    const payload = getTokenPayload(req)
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const bookings = await getBookings()
      if (payload.role === 'rider')
        return res.status(200).json(bookings.filter(b => b.riderNb === payload.nb))
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
      const [shifts, bookings, riders] = await Promise.all([getShifts(), getBookings(), getRiders()])

      const shift = shifts.find(s => s.id === shiftId)
      if (!shift) return res.status(404).json({ error: `Shift ${shiftId} not found` })
      if (shift.booked >= shift.capacity) return res.status(400).json({ error: 'This shift is full' })

      // ── CITY ISOLATION ENFORCEMENT ──────────────────────────
      // A rider may only book shifts in their assigned city.
      // If the rider has no city assigned, booking is blocked until
      // an admin assigns one (prevents cross-city booking via API).
      const riderRecordForCity = riders.find(r => r.nb === rider.nb)
      const riderCity = normalizeCity(riderRecordForCity?.city || '')
      if (!riderCity) {
        return res.status(403).json({ error: 'Your account has no city assigned. Contact your admin.' })
      }
      if (normalizeCity(shift.city) !== riderCity) {
        return res.status(403).json({ error: `This shift is in ${shift.city}. You are assigned to ${riderCity} and can only book shifts there.` })
      }

      const already = bookings.find(b => b.riderNb===rider.nb && b.shiftId===shiftId && b.status==='Confirmed')
      if (already) return res.status(400).json({ error: `You already have shift ${shiftId} booked (${already.id})` })

      // Overlap check
      const shiftDateISO = toISODate(shift.date)
      const myConfirmed  = bookings.filter(b => b.riderNb===rider.nb && b.status==='Confirmed')
      for (const bk of myConfirmed) {
        const bkShift = shifts.find(s => s.id===bk.shiftId)
        const bkDate  = bkShift ? toISODate(bkShift.date) : toISODate(bk.shiftDate)
        if (bkDate !== shiftDateISO) continue
        const bkStart = bkShift?.start || bk.startTime
        const bkEnd   = bkShift?.end   || bk.endTime
        if (bkStart && bkEnd && shiftsOverlap(shift, {start:bkStart,end:bkEnd})) {
          return res.status(400).json({ error: `Overlaps with booking ${bk.shiftId} (${bkStart}–${bkEnd})` })
        }
      }

      // Hour limits
      let dailyHours=0, weeklyHours=0
      for (const bk of myConfirmed) {
        const bkShift   = shifts.find(s => s.id===bk.shiftId)
        const bkDateISO = bkShift ? toISODate(bkShift.date) : toISODate(bk.shiftDate)
        const bkHours   = bkShift ? bkShift.hours : bk.hours
        if (!bkDateISO || !bkHours) continue
        if (bkDateISO === shiftDateISO) dailyHours  += Number(bkHours)
        if (isThisWeek(bkDateISO))      weeklyHours += Number(bkHours)
      }
      if (dailyHours  + Number(shift.hours) > DAILY_LIMIT)  return res.status(400).json({ error: `Daily limit: ${+(DAILY_LIMIT-dailyHours).toFixed(1)}h left today (max ${DAILY_LIMIT}h/day)` })
      if (weeklyHours + Number(shift.hours) > WEEKLY_LIMIT) return res.status(400).json({ error: `Weekly limit: ${+(WEEKLY_LIMIT-weeklyHours).toFixed(1)}h left (max ${WEEKLY_LIMIT}h/week)` })

      const maxNum    = bookings.reduce((m,b) => { const n=parseInt(b.id.replace(/\D/g,''))||0; return n>m?n:m }, 0)
      const id        = `BK${String(maxNum+1).padStart(3,'0')}`
      const newBooked = Number(shift.booked) + 1
      const newWeekly = +(weeklyHours + Number(shift.hours)).toFixed(1)
      const riderData = riders.find(r => r.nb===rider.nb)
      const riderName = riderData?.name || rider.nb
      const city      = riderData?.city || shift.city || ''

      await Promise.all([
        addBookingToSheet({ id, riderNb:rider.nb, riderName, city,
          shift: { id:shift.id, date:shift.date, day:shift.day, start:shift.start, end:shift.end, hours:shift.hours } }),
        updateShiftInSheet(shiftId, { booked:newBooked, status:newBooked>=shift.capacity?'FULL':'OPEN' }),
        updateRiderInSheet(rider.nb, { weeklyHours:newWeekly }),
      ])

      return res.status(201).json({ ok:true, bookingId:id, weeklyHours:newWeekly, weeklyRemaining:+(WEEKLY_LIMIT-newWeekly).toFixed(1) })
    } catch (e: any) {
      console.error('[POST /api/bookings]', e.message)
      return res.status(500).json({ error: 'Booking failed: ' + e.message })
    }
  }

  if (req.method === 'PATCH') {
    const rider = requireRider(req, res)
    if (!rider) return
    const { bookingId, reason } = req.body
    if (!bookingId || !reason) return res.status(400).json({ error: 'bookingId and reason required' })

    try {
      const [bookings, riders, shifts] = await Promise.all([getBookings(), getRiders(), getShifts()])
      const booking = bookings.find(b => b.id===bookingId && b.riderNb===rider.nb)
      if (!booking) return res.status(404).json({ error: 'Booking not found' })
      if (booking.status==='Cancelled') return res.status(400).json({ error: 'Already cancelled' })

      const weeklyCancels = bookings.filter(b => b.riderNb===rider.nb && b.status==='Cancelled' && isThisWeek(b.shiftDate)).length
      if (weeklyCancels >= CANCEL_WEEKLY_LIMIT)
        return res.status(400).json({ error: `Weekly cancellation limit (${CANCEL_WEEKLY_LIMIT}) reached` })

      const shift     = shifts.find(s => s.id===booking.shiftId)
      const newBooked = Math.max(0, (Number(shift?.booked) || 1) - 1)
      const remaining = bookings.filter(b => b.riderNb===rider.nb && b.status==='Confirmed' && b.id!==bookingId)
      let newWeekly = 0
      for (const bk of remaining) {
        const bkShift   = shifts.find(s => s.id===bk.shiftId)
        const bkDateISO = bkShift ? toISODate(bkShift.date) : toISODate(bk.shiftDate)
        const bkHours   = bkShift ? bkShift.hours : bk.hours
        if (bkDateISO && isThisWeek(bkDateISO) && bkHours) newWeekly += Number(bkHours)
      }
      newWeekly = +newWeekly.toFixed(1)

      await Promise.all([
        cancelBookingInSheet(bookingId, reason),
        shift ? updateShiftInSheet(booking.shiftId, {booked:newBooked, status:'OPEN'}) : Promise.resolve(),
        updateRiderInSheet(rider.nb, { cancellations:weeklyCancels+1, weeklyHours:newWeekly }),
      ])
      return res.status(200).json({ ok:true, weeklyHours:newWeekly, weeklyCancels:weeklyCancels+1 })
    } catch (e: any) {
      return res.status(500).json({ error: 'Cancellation failed: ' + e.message })
    }
  }
  res.status(405).end()
}
