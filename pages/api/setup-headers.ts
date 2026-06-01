// GET /api/setup-headers  — call once from browser to write column headers
// Admin-protected. Visit this URL after deploying to fix your Bookings sheet.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../lib/auth'
import { ensureBookingsHeaders } from '../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return
  try {
    await ensureBookingsHeaders()
    return res.status(200).json({ ok: true, message: 'Bookings sheet headers updated to 12-column format' })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
