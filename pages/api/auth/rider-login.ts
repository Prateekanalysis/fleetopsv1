import type { NextApiRequest, NextApiResponse } from 'next'
import { signRiderToken, setCookie } from '../../../lib/auth'
import { getRiders } from '../../../lib/sheets'

function normalisePhone(p: string): string {
  return p.replace(/[\s\-().]/g, '')
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { nb, contact } = req.body
  if (!nb || !contact) return res.status(400).json({ error: 'MB No and email/phone required' })

  try {
    const riders = await getRiders()
    const rider  = riders.find(r => r.nb.toUpperCase().trim() === nb.trim().toUpperCase())
    if (!rider) return res.status(401).json({ error: `MB No "${nb.trim()}" not found. Check your number.` })
    if (!rider.active) return res.status(403).json({ error: 'Your account is inactive. Contact your admin.' })

    const inputClean = contact.trim().toLowerCase()
    const emailMatch = rider.email.toLowerCase().trim() === inputClean
    const phoneMatch = normalisePhone(rider.phone) === normalisePhone(contact)
    if (!emailMatch && !phoneMatch)
      return res.status(401).json({ error: 'Email or phone does not match our records.' })

    const token = signRiderToken(rider.nb)
    setCookie(res, 'fleetops_token', token, 60*60*12)
    return res.status(200).json({
      ok: true,
      rider: { nb: rider.nb, name: rider.name, city: rider.city, email: rider.email, phone: rider.phone },
    })
  } catch (e: any) {
    console.error('[rider-login]', e.message)
    return res.status(500).json({ error: 'Server error. Please try again.' })
  }
}
