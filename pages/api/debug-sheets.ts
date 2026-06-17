// GET /api/debug-sheets  (admin only)
// Diagnostic endpoint: shows exactly what the live deployment sees in
// Google Sheets right now — the real tab names, the configured tab names,
// and how many shift rows were successfully read from each city. Use this
// instead of comparing screenshots when one city silently shows zero shifts.
import type { NextApiRequest, NextApiResponse } from 'next'
import { requireAdmin } from '../../lib/auth'
import { CITIES, CITY_TAB, listActualTabNames, getShifts, getRiders } from '../../lib/sheets'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!requireAdmin(req, res)) return

  const report: any = {
    timestamp: new Date().toISOString(),
    configuredTabNames: CITY_TAB,
  }

  try {
    report.actualTabNames = await listActualTabNames()
  } catch (e: any) {
    report.actualTabNamesError = e.message
  }

  try {
    const shifts = await getShifts()
    report.shiftsPerCity = {}
    for (const city of CITIES) {
      const cityShifts = shifts.filter(s => s.city === city)
      report.shiftsPerCity[city] = {
        count: cityShifts.length,
        sampleIds: cityShifts.slice(0, 3).map(s => s.id),
        sampleDates: cityShifts.slice(0, 3).map(s => s.date),
        tabNameUsed: cityShifts[0]?.tabName || '(none read)',
      }
    }
    report.totalShifts = shifts.length
  } catch (e: any) {
    report.shiftsError = e.message
  }

  try {
    const riders = await getRiders()
    report.ridersPerCity = {}
    for (const city of CITIES) {
      report.ridersPerCity[city] = riders.filter(r => r.city === city).length
    }
    report.totalRiders = riders.length
  } catch (e: any) {
    report.ridersError = e.message
  }

  return res.status(200).json(report)
}
