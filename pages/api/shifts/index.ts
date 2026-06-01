import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin, getTokenPayload } from '../../../lib/auth'
import { getShifts, addShiftToSheet, updateShiftInSheet, deleteShiftFromSheet } from '../../../lib/sheets'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
function toMins(t: string) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const payload = getTokenPayload(req)
    if (!payload) return res.status(401).json({ error: 'Unauthorized' })
    try {
      return res.status(200).json(await getShifts())
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch shifts: ' + e.message })
    }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return
    const { date, start, end, capacity, notes } = req.body
    if (!date || !start || !end) return res.status(400).json({ error: 'date, start, end are required' })
    try {
      const existing = await getShifts()
      const num = existing.length + 1
      const id = `SH${String(num).padStart(3, '0')}`
      const d = new Date(date)
      const hours = Math.max(0, Math.round((toMins(end) - toMins(start)) / 60 * 10) / 10)
      await addShiftToSheet({ id, date, day: DAYS[d.getDay()], start, end, hours, capacity: parseInt(capacity) || 5, notes: notes || 'General shift' })
      return res.status(201).json({ ok: true, id })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to create shift: ' + e.message })
    }
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return
    const { id, ...fields } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    try {
      await updateShiftInSheet(id, fields)
      return res.status(200).json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to update shift: ' + e.message })
    }
  }

  if (req.method === 'DELETE') {
    if (!requireAdmin(req, res)) return
    const { id } = req.body
    if (!id) return res.status(400).json({ error: 'id required' })
    try {
      await deleteShiftFromSheet(id)
      return res.status(200).json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to delete shift: ' + e.message })
    }
  }

  res.status(405).end()
}
