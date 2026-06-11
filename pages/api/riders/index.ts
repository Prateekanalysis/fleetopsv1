import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../../lib/auth'
import { getRiders, addRiderToSheet, updateRiderInSheet } from '../../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    if (!requireAdmin(req, res)) return
    try {
      return res.status(200).json(await getRiders())
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to fetch riders: ' + e.message })
    }
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return
    const { nb, name, city, phone, email } = req.body
    if (!nb || !name) return res.status(400).json({ error: 'MB No and name required' })
    try {
      const existing = await getRiders()
      if (existing.find(r => r.nb.toUpperCase() === nb.toUpperCase()))
        return res.status(400).json({ error: 'MB No already exists' })
      await addRiderToSheet({ nb: nb.toUpperCase().trim(), name, city: city||'', phone: phone||'', email: email||'' })
      return res.status(201).json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to add rider: ' + e.message })
    }
  }

  if (req.method === 'PATCH') {
    if (!requireAdmin(req, res)) return
    const { nb, ...fields } = req.body
    if (!nb) return res.status(400).json({ error: 'MB No required' })
    try {
      await updateRiderInSheet(nb, fields)
      return res.status(200).json({ ok: true })
    } catch (e: any) {
      return res.status(500).json({ error: 'Failed to update rider: ' + e.message })
    }
  }
  res.status(405).end()
}
