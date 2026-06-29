import type { Request, Response } from 'express'
import * as analyticsService from '../services/analytics.service.js'
import { handleError } from '../utils/handleError.js'

function routeId(req: Request): string {
  return String(req.params.id)
}

/** GET /api/workers/:id/analytics — curator or admin only */
export async function getAnalytics(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const data = await analyticsService.getWorkerAnalytics(routeId(req))
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** POST /api/workers/:id/analytics/view — public, records a profile view */
export async function trackView(req: Request, res: Response) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? req.socket.remoteAddress ?? 'unknown'
    await analyticsService.recordProfileView(routeId(req), ip)
    return res.json({ status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/analytics/trends — view trends over N days */
export async function getViewTrends(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const days = Math.min(Number(req.query.days) || 30, 90)
    const data = await analyticsService.getWorkerViewTrends(routeId(req), days)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/analytics/dashboard — personal dashboard metrics */
export async function getWorkerPersonalDashboard(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const range = analyticsService.parseAnalyticsDateRange(req.query)
    const data = await analyticsService.getWorkerPersonalDashboard(routeId(req), range)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/workers/:id/analytics/export — CSV export for one worker */
export async function exportWorkerPersonalCsv(req: Request, res: Response) {
  try {
    await analyticsService.assertCanAccessWorkerAnalytics(routeId(req), req.user!.id, req.user!.role)
    const range = analyticsService.parseAnalyticsDateRange(req.query)
    const csv = await analyticsService.exportPersonalWorkerAnalyticsCsv(routeId(req), range)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', `attachment; filename="worker-${routeId(req)}-analytics.csv"`)
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/curator — curator's aggregated analytics */
export async function getCuratorDashboard(req: Request, res: Response) {
  try {
    const data = await analyticsService.getCuratorAnalytics(req.user!.id)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/platform — admin platform-wide analytics */
export async function getPlatformDashboard(req: Request, res: Response) {
  try {
    const data = await analyticsService.getPlatformAnalytics()
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/top-workers — leaderboard by metric */
export async function getTopWorkers(req: Request, res: Response) {
  try {
    const metric = (req.query.metric as string) || 'views'
    const validMetrics = ['views', 'tips', 'bookmarks', 'rating']
    const safeMetric = validMetrics.includes(metric) ? metric as 'views' | 'tips' | 'bookmarks' | 'rating' : 'views'
    const limit = Math.min(Number(req.query.limit) || 10, 50)
    const data = await analyticsService.getTopWorkers(safeMetric, limit)
    return res.json({ data, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/export/curator — CSV export of curator's worker analytics */
export async function exportCuratorCsv(req: Request, res: Response) {
  try {
    const csv = await analyticsService.exportWorkerAnalyticsCsv(req.user!.id)
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="worker-analytics.csv"')
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}

/** GET /api/analytics/export/platform — CSV export of platform analytics (admin) */
export async function exportPlatformCsv(req: Request, res: Response) {
  try {
    const csv = await analyticsService.exportPlatformAnalyticsCsv()
    res.setHeader('Content-Type', 'text/csv')
    res.setHeader('Content-Disposition', 'attachment; filename="platform-analytics.csv"')
    return res.send(csv)
  } catch (err) {
    return handleError(res, err)
  }
}
