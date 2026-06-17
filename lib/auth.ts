import jwt from 'jsonwebtoken'
import { NextApiRequest, NextApiResponse } from 'next'

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production'

export function signAdminToken() {
  return jwt.sign({ role: 'admin' }, SECRET, { expiresIn: '24h' })
}

export function signRiderToken(nb: string) {
  return jwt.sign({ role: 'rider', nb }, SECRET, { expiresIn: '12h' })
}

export function verifyToken(token: string): { role: string; nb?: string } | null {
  try {
    return jwt.verify(token, SECRET) as { role: string; nb?: string }
  } catch {
    return null
  }
}

export function requireAdmin(req: NextApiRequest, res: NextApiResponse): boolean {
  const raw = req.headers.cookie || ''
  const cookies = parseCookies(raw)
  const token = cookies['fleetops_token']
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return false }
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'admin') {
    res.status(403).json({ error: 'Admin access only' }); return false
  }
  return true
}

export function requireRider(req: NextApiRequest, res: NextApiResponse): { nb: string } | null {
  const raw = req.headers.cookie || ''
  const cookies = parseCookies(raw)
  const token = cookies['fleetops_token']
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null }
  const payload = verifyToken(token)
  if (!payload || payload.role !== 'rider' || !payload.nb) {
    res.status(403).json({ error: 'Rider access only' }); return null
  }
  return { nb: payload.nb }
}

export function getTokenPayload(req: NextApiRequest): { role: string; nb?: string } | null {
  const raw = req.headers.cookie || ''
  const cookies = parseCookies(raw)
  const token = cookies['fleetops_token']
  if (!token) return null
  return verifyToken(token)
}

function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {}
  cookieHeader.split(';').forEach(part => {
    const [k, ...v] = part.trim().split('=')
    if (k) cookies[k.trim()] = decodeURIComponent(v.join('='))
  })
  return cookies
}

export function setCookie(res: NextApiResponse, name: string, value: string, maxAge: number) {
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : ''
  res.setHeader('Set-Cookie', `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secure}`)
}

export function clearCookie(res: NextApiResponse, name: string) {
  res.setHeader('Set-Cookie', `${name}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0`)
}
