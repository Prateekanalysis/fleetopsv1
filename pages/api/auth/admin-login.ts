import type { NextApiRequest, NextApiResponse } from 'next'
import { signAdminToken, setCookie } from '../../../lib/auth'

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { email, password } = req.body
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (email !== process.env.ADMIN_EMAIL || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' })
  }
  const token = signAdminToken()
  setCookie(res, 'fleetops_token', token, 60 * 60 * 24)
  return res.status(200).json({ ok: true })
}
