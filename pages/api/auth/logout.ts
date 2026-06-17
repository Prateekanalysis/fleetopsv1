import type { NextApiRequest, NextApiResponse } from 'next'
import { clearCookie } from '../../../lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  clearCookie(res, 'fleetops_token')
  return res.status(200).json({ ok: true })
}
