// GET /api/setup-headers  (admin only)
// Writes headers to Bookings sheet AND all city shift tabs.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../lib/auth'
import { ensureBookingsHeaders, ensureShiftTabHeaders, CITIES, CITY_TAB } from '../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return
  const results: Record<string, string> = {}
  try {
    await ensureBookingsHeaders()
    results['Bookings'] = 'OK — 14 headers written'
  } catch (e: any) {
    results['Bookings'] = 'ERROR: ' + e.message
  }
  for (const city of CITIES) {
    try {
      await ensureShiftTabHeaders(city)
      results[CITY_TAB[city]] = 'OK — 11 headers written'
    } catch (e: any) {
      results[CITY_TAB[city]] = 'ERROR: ' + e.message
    }
  }
  return res.status(200).json({ ok: true, results })
}
