import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin, getTokenPayload } from '../../../lib/auth'
import { getShifts, addShiftToSheet, updateShiftInSheet, deleteShiftFromSheet, CITY_TAB } from '../../../lib/sheets'

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function toMins(t: string) { const [h,m]=t.split(':').map(Number); return h*60+m }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  // GET — returns all shifts from all city tabs combined
  if (req.method === 'GET') {
    const payload = getTokenPayload(req)
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    try {
      const shifts = await getShifts()
      return res.status(200).json(shifts)
    } catch (e: any) {
      console.error('[GET /api/shifts]', e.message)
      return res.status(500).json({ error: 'Failed to fetch shifts: ' + e.message })
    }
  }

  // POST — create a new shift in the correct city tab
  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return
    const { date, start, end, capacity, notes, city } = req.body
    if (!date || !start || !end) return res.status(400).json({ error: 'date, start, end required' })
    if (!city || !CITY_TAB[city]) {
      return res.status(400).json({ error: `city required — must be one of: ${Object.keys(CITY_TAB).join(', ')}` })
    }
    try {
      // Load all shifts to find max ID (avoids duplicate IDs across tabs)
      const existing = await getShifts()
      const maxNum = existing.reduce((max, s) => {
        const n = parseInt(s.id.replace(/\D/g,'')) || 0
        return n > max ? n : max
      }, 0)
      const id    = `SH${String(maxNum + 1).padStart(3, '0')}`
      const d     = new Date(date + 'T00:00:00')
      const hours = Math.max(0, Math.round((toMins(end) - toMins(start)) / 60 * 10) / 10)
      await addShiftToSheet({
        id, city, date, day: DAYS[d.getDay()], start, end,
        hours, capacity: parseInt(capacity) || 5, notes: notes || 'General shift',
      })
      return res.status(201).json({ ok: true, id, city })
    } catch (e: any) {
      console.error('[POST /api/shifts]', e.message)
      return res.status(500).json({ error: 'Failed to create shift: ' + e.message })
    }
  }

  // PATCH — update an existing shift (finds the correct city tab automatically)
  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return
    const { id, ...fields } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    try {
      await updateShiftInSheet(id, fields)
      return res.status(200).json({ ok: true })
    } catch (e: any) {
      console.error('[PATCH /api/shifts]', e.message)
      return res.status(500).json({ error: 'Failed to update shift: ' + e.message })
    }
  }

  // DELETE — remove a shift (finds the correct city tab automatically)
  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    try {
      await deleteShiftFromSheet(id)
      return res.status(200).json({ ok: true })
    } catch (e: any) {
      console.error('[DELETE /api/shifts]', e.message)
      return res.status(500).json({ error: 'Failed to delete shift: ' + e.message })
    }
  }

  res.status(405).end()
}
