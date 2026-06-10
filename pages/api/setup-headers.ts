// GET /api/setup-headers  (admin only)
// Visit once after deploy to write 13-column headers to Bookings sheet row 1.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../lib/auth'
import { ensureBookingsHeaders, BOOKING_HEADERS } from '../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return
  try {
    await ensureBookingsHeaders()
    return res.status(200).json({
      ok: true,
      columns: BOOKING_HEADERS,
      message: `Bookings sheet row 1 updated with ${BOOKING_HEADERS.length} headers`,
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
