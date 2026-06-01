// GET /api/setup-headers  (admin only)
// Visit once after deploying to write correct column headers to Bookings sheet.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../lib/auth'
import { ensureBookingsHeaders } from '../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return
  try {
    await ensureBookingsHeaders()
    return res.status(200).json({
      ok: true,
      message: 'Bookings!A1:J1 updated → Booking_ID | Rider_NB | Shift_ID | Date | Start | End | Hours | Status | Cancel_Reason | Timestamp',
    })
  } catch (e: any) {
    return res.status(500).json({ error: e.message })
  }
}
