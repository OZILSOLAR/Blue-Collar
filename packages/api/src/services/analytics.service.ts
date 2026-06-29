import { db } from '../db.js'
import { AppError } from './AppError.js'

type DateRange = {
  startDate?: Date
  endDate?: Date
}

type TimeSeriesPoint = {
  date: string
  views: number
  uniqueViews: number
  tips: number
  tipCount: number
  avgRating: number | null
  reviewCount: number
  earnings: number
}

// ── Recording helpers ────────────────────────────────────────────────────────

export async function recordProfileView(workerId: string, ip: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const existing = await db.profileView.findFirst({
    where: { workerId, ip, viewedAt: { gte: today } },
  })

  await db.workerAnalytics.upsert({
    where: { workerId },
    create: { workerId, totalViews: 1, uniqueViews: existing ? 0 : 1 },
    update: {
      totalViews: { increment: 1 },
      ...(existing ? {} : { uniqueViews: { increment: 1 } }),
    },
  })

  if (!existing) {
    await db.profileView.create({ data: { workerId, ip } })
  }
}

export async function recordTip(workerId: string, amount: number, txHash?: string) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)
  if (!Number.isFinite(amount) || amount <= 0) throw new AppError('Tip amount must be greater than 0', 400)

  await db.$transaction([
    db.workerAnalytics.upsert({
      where: { workerId },
      create: { workerId, totalTips: amount, tipCount: 1 },
      update: { totalTips: { increment: amount }, tipCount: { increment: 1 } },
    }),
    db.workerTipEvent.create({ data: { workerId, amount, txHash } }),
  ])
}

export async function updateBookmarkCount(workerId: string, delta: 1 | -1) {
  await db.workerAnalytics.upsert({
    where: { workerId },
    create: { workerId, bookmarkCount: delta === 1 ? 1 : 0 },
    update: { bookmarkCount: { increment: delta } },
  })
}

export async function recordContact(workerId: string) {
  await db.workerAnalytics.upsert({
    where: { workerId },
    create: { workerId, contactCount: 1 },
    update: { contactCount: { increment: 1 } },
  })
}

// ── Worker-level analytics (curator/admin) ───────────────────────────────────

export async function getWorkerAnalytics(workerId: string) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    include: { category: true },
  })
  if (!worker) throw new AppError('Worker not found', 404)

  const analytics = await db.workerAnalytics.findUnique({ where: { workerId } })

  const [reviewAgg, recentViews, recentContacts] = await Promise.all([
    db.review.aggregate({
      where: { workerId, status: 'approved' },
      _avg: { rating: true },
      _count: true,
    }),
    db.profileView.groupBy({
      by: ['workerId'],
      where: {
        workerId,
        viewedAt: { gte: daysAgo(30) },
      },
      _count: true,
    }),
    db.contactRequest.count({
      where: { workerId, createdAt: { gte: daysAgo(30) } },
    }),
  ])

  const respondedContacts = await db.contactRequest.count({
    where: { workerId, status: { not: 'pending' } },
  })
  const totalContacts = await db.contactRequest.count({ where: { workerId } })
  const responseRate = totalContacts > 0 ? Math.round((respondedContacts / totalContacts) * 100) : 0

  return {
    workerId,
    workerName: worker.name,
    category: worker.category.name,
    totalViews: analytics?.totalViews ?? 0,
    uniqueViews: analytics?.uniqueViews ?? 0,
    viewsLast30Days: recentViews[0]?._count ?? 0,
    totalTips: analytics?.totalTips ?? 0,
    tipCount: analytics?.tipCount ?? 0,
    bookmarkCount: analytics?.bookmarkCount ?? 0,
    contactCount: analytics?.contactCount ?? 0,
    contactsLast30Days: recentContacts,
    responseRate,
    avgRating: reviewAgg._avg.rating ?? 0,
    reviewCount: reviewAgg._count,
    updatedAt: analytics?.updatedAt ?? null,
  }
}

// ── Curator analytics ────────────────────────────────────────────────────────

export async function getCuratorAnalytics(curatorId: string) {
  const workers = await db.worker.findMany({
    where: { curatorId },
    select: { id: true, name: true, isActive: true, category: { select: { name: true } } },
  })

  if (workers.length === 0) {
    return {
      totalWorkers: 0,
      activeWorkers: 0,
      workers: [],
      totals: { views: 0, uniqueViews: 0, tips: 0, tipCount: 0, bookmarks: 0, contacts: 0, avgRating: 0 },
    }
  }

  const workerIds = workers.map((w) => w.id)

  const [analyticsRows, reviewAgg, contactsThisMonth, viewsThisMonth] = await Promise.all([
    db.workerAnalytics.findMany({ where: { workerId: { in: workerIds } } }),
    db.review.aggregate({
      where: { workerId: { in: workerIds }, status: 'approved' },
      _avg: { rating: true },
      _count: true,
    }),
    db.contactRequest.count({
      where: { workerId: { in: workerIds }, createdAt: { gte: daysAgo(30) } },
    }),
    db.profileView.count({
      where: { workerId: { in: workerIds }, viewedAt: { gte: daysAgo(30) } },
    }),
  ])

  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  const workerSummaries = workers.map((w) => {
    const a = analyticsMap.get(w.id)
    return {
      id: w.id,
      name: w.name,
      category: w.category.name,
      isActive: w.isActive,
      views: a?.totalViews ?? 0,
      uniqueViews: a?.uniqueViews ?? 0,
      tips: a?.totalTips ?? 0,
      tipCount: a?.tipCount ?? 0,
      bookmarks: a?.bookmarkCount ?? 0,
      contacts: a?.contactCount ?? 0,
    }
  })

  const totals = analyticsRows.reduce(
    (acc, a) => ({
      views: acc.views + a.totalViews,
      uniqueViews: acc.uniqueViews + a.uniqueViews,
      tips: acc.tips + a.totalTips,
      tipCount: acc.tipCount + a.tipCount,
      bookmarks: acc.bookmarks + a.bookmarkCount,
      contacts: acc.contacts + a.contactCount,
    }),
    { views: 0, uniqueViews: 0, tips: 0, tipCount: 0, bookmarks: 0, contacts: 0 },
  )

  return {
    totalWorkers: workers.length,
    activeWorkers: workers.filter((w) => w.isActive).length,
    workers: workerSummaries,
    totals: {
      ...totals,
      avgRating: reviewAgg._avg.rating ?? 0,
      reviewCount: reviewAgg._count,
      contactsThisMonth,
      viewsThisMonth,
    },
  }
}

// ── Platform-wide analytics (admin) ──────────────────────────────────────────

export async function getPlatformAnalytics() {
  const now = new Date()
  const thirtyDaysAgo = daysAgo(30)
  const sixtyDaysAgo = daysAgo(60)

  const [
    totalWorkers,
    activeWorkers,
    totalUsers,
    totalCurators,
    workersThisMonth,
    workersLastMonth,
    usersThisMonth,
    usersLastMonth,
    totalViews,
    viewsThisMonth,
    totalReviews,
    reviewsThisMonth,
    totalContacts,
    contactsThisMonth,
    topCategories,
    recentWorkers,
    recentUsers,
    tipAgg,
    userGrowth,
    workerGrowth,
  ] = await Promise.all([
    db.worker.count(),
    db.worker.count({ where: { isActive: true } }),
    db.user.count(),
    db.user.count({ where: { role: 'curator' } }),
    db.worker.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.worker.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.user.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
    db.profileView.count(),
    db.profileView.count({ where: { viewedAt: { gte: thirtyDaysAgo } } }),
    db.review.count(),
    db.review.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.contactRequest.count(),
    db.contactRequest.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
    db.category.findMany({
      select: { id: true, name: true, _count: { select: { workers: true } } },
      orderBy: { workers: { _count: 'desc' } },
      take: 10,
    }),
    db.worker.findMany({
      select: { id: true, name: true, createdAt: true, category: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.user.findMany({
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, role: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    db.workerAnalytics.aggregate({
      _sum: { totalTips: true, tipCount: true },
    }),
    getGrowthData('user', 6),
    getGrowthData('worker', 6),
  ])

  return {
    overview: {
      totalWorkers,
      activeWorkers,
      totalUsers,
      totalCurators,
    },
    engagement: {
      totalViews,
      viewsThisMonth,
      totalReviews,
      reviewsThisMonth,
      totalContacts,
      contactsThisMonth,
    },
    revenue: {
      totalTips: tipAgg._sum.totalTips ?? 0,
      totalTipCount: tipAgg._sum.tipCount ?? 0,
    },
    growth: {
      workersThisMonth,
      workersLastMonth,
      workerGrowthPct: calcGrowthPct(workersThisMonth, workersLastMonth),
      usersThisMonth,
      usersLastMonth,
      userGrowthPct: calcGrowthPct(usersThisMonth, usersLastMonth),
    },
    trends: {
      userGrowth,
      workerGrowth,
    },
    topCategories: topCategories.map((cat) => ({
      name: cat.name,
      count: cat._count.workers,
    })),
    recentWorkers,
    recentUsers,
  }
}

// ── View trends for a worker (daily views over N days) ───────────────────────

export async function getWorkerViewTrends(workerId: string, days = 30) {
  const worker = await db.worker.findUnique({ where: { id: workerId } })
  if (!worker) throw new AppError('Worker not found', 404)

  const since = daysAgo(days)
  const views = await db.profileView.findMany({
    where: { workerId, viewedAt: { gte: since } },
    select: { viewedAt: true },
    orderBy: { viewedAt: 'asc' },
  })

  const dailyMap = new Map<string, number>()
  for (let i = 0; i < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() - (days - 1 - i))
    dailyMap.set(d.toISOString().slice(0, 10), 0)
  }
  for (const v of views) {
    const key = v.viewedAt.toISOString().slice(0, 10)
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + 1)
  }

  return Array.from(dailyMap.entries()).map(([date, count]) => ({ date, views: count }))
}

// ── Export analytics as CSV ──────────────────────────────────────────────────

export async function exportWorkerAnalyticsCsv(curatorId: string) {
  const workers = await db.worker.findMany({
    where: { curatorId },
    include: { category: true },
  })

  const workerIds = workers.map((w) => w.id)
  const analyticsRows = await db.workerAnalytics.findMany({
    where: { workerId: { in: workerIds } },
  })
  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  const reviewAggs = await Promise.all(
    workerIds.map(async (id) => {
      const agg = await db.review.aggregate({
        where: { workerId: id, status: 'approved' },
        _avg: { rating: true },
        _count: true,
      })
      return { id, avg: agg._avg.rating ?? 0, count: agg._count }
    }),
  )
  const reviewMap = new Map(reviewAggs.map((r) => [r.id, r]))

  const header = 'Worker Name,Category,Total Views,Unique Views,Tips (XLM),Tip Count,Bookmarks,Contacts,Avg Rating,Reviews'
  const rows = workers.map((w) => {
    const a = analyticsMap.get(w.id)
    const r = reviewMap.get(w.id)
    return [
      csvEscape(w.name),
      csvEscape(w.category.name),
      a?.totalViews ?? 0,
      a?.uniqueViews ?? 0,
      a?.totalTips ?? 0,
      a?.tipCount ?? 0,
      a?.bookmarkCount ?? 0,
      a?.contactCount ?? 0,
      (r?.avg ?? 0).toFixed(1),
      r?.count ?? 0,
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

export async function exportPlatformAnalyticsCsv() {
  const workers = await db.worker.findMany({
    include: { category: true, curator: { select: { firstName: true, lastName: true } } },
  })

  const workerIds = workers.map((w) => w.id)
  const analyticsRows = await db.workerAnalytics.findMany({
    where: { workerId: { in: workerIds } },
  })
  const analyticsMap = new Map(analyticsRows.map((a) => [a.workerId, a]))

  const header = 'Worker Name,Category,Curator,Total Views,Unique Views,Tips (XLM),Tip Count,Bookmarks,Contacts'
  const rows = workers.map((w) => {
    const a = analyticsMap.get(w.id)
    return [
      csvEscape(w.name),
      csvEscape(w.category.name),
      csvEscape(`${w.curator.firstName} ${w.curator.lastName}`),
      a?.totalViews ?? 0,
      a?.uniqueViews ?? 0,
      a?.totalTips ?? 0,
      a?.tipCount ?? 0,
      a?.bookmarkCount ?? 0,
      a?.contactCount ?? 0,
    ].join(',')
  })

  return [header, ...rows].join('\n')
}

// ── Top workers leaderboard ──────────────────────────────────────────────────

export async function getTopWorkers(metric: 'views' | 'tips' | 'bookmarks' | 'rating', limit = 10) {
  const orderField = {
    views: 'totalViews',
    tips: 'totalTips',
    bookmarks: 'bookmarkCount',
    rating: 'avgRating',
  }[metric] as string

  const rows = await db.workerAnalytics.findMany({
    orderBy: { [orderField]: 'desc' },
    take: limit,
    include: { worker: { select: { name: true, category: { select: { name: true } } } } },
  })

  return rows.map((r, i) => ({
    rank: i + 1,
    workerId: r.workerId,
    workerName: r.worker.name,
    category: r.worker.category.name,
    totalViews: r.totalViews,
    totalTips: r.totalTips,
    bookmarkCount: r.bookmarkCount,
    avgRating: r.avgRating,
  }))
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function calcGrowthPct(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return Math.round(((current - previous) / previous) * 100)
}

function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

async function getGrowthData(model: 'user' | 'worker', months: number) {
  const data: { month: string; count: number }[] = []
  const now = new Date()

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const label = start.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })

    const count = model === 'user'
      ? await db.user.count({ where: { createdAt: { gte: start, lt: end } } })
      : await db.worker.count({ where: { createdAt: { gte: start, lt: end } } })
    data.push({ month: label, count })
  }

  return data
}

// ── Personal worker dashboard analytics ──────────────────────────────────────

export async function assertCanAccessWorkerAnalytics(workerId: string, userId: string, role: string) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    select: { id: true, curatorId: true },
  })
  if (!worker) throw new AppError('Worker not found', 404)
  if (role !== 'admin' && worker.curatorId !== userId) throw new AppError('Forbidden', 403)
  return worker
}

export function parseAnalyticsDateRange(query: { startDate?: unknown; endDate?: unknown; days?: unknown }): Required<DateRange> {
  const now = new Date()
  const endDate = parseDateBoundary(query.endDate, 'end') ?? now
  const defaultDays = Math.min(Math.max(Number(query.days) || 30, 1), 366)
  const startDate = parseDateBoundary(query.startDate, 'start') ?? daysBefore(endDate, defaultDays - 1)

  if (startDate > endDate) throw new AppError('startDate must be before or equal to endDate', 400)

  const maxRangeMs = 366 * 24 * 60 * 60 * 1000
  if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
    throw new AppError('Date range cannot exceed 366 days', 400)
  }

  return { startDate, endDate }
}

export async function getWorkerPersonalDashboard(workerId: string, range: Required<DateRange>) {
  const worker = await db.worker.findUnique({
    where: { id: workerId },
    select: { id: true, name: true, walletAddress: true, category: { select: { name: true } } },
  })
  if (!worker) throw new AppError('Worker not found', 404)

  const dateWhere = dateRangeWhere(range)
  const previous = getPreviousRange(range)

  const [
    currentViews,
    previousViews,
    tipAgg,
    previousTipAgg,
    reviewAgg,
    previousReviewAgg,
    ratingDistribution,
    contacts,
    series,
  ] = await Promise.all([
    db.profileView.count({ where: { workerId, viewedAt: dateWhere } }),
    db.profileView.count({ where: { workerId, viewedAt: dateRangeWhere(previous) } }),
    db.workerTipEvent.aggregate({ where: { workerId, createdAt: dateWhere }, _sum: { amount: true }, _count: true }),
    db.workerTipEvent.aggregate({ where: { workerId, createdAt: dateRangeWhere(previous) }, _sum: { amount: true }, _count: true }),
    db.review.aggregate({ where: { workerId, status: 'approved', createdAt: dateWhere }, _avg: { rating: true }, _count: true }),
    db.review.aggregate({ where: { workerId, status: 'approved', createdAt: dateRangeWhere(previous) }, _avg: { rating: true }, _count: true }),
    db.review.groupBy({ by: ['rating'], where: { workerId, status: 'approved', createdAt: dateWhere }, _count: { rating: true }, orderBy: { rating: 'desc' } }),
    db.contactRequest.count({ where: { workerId, createdAt: dateWhere } }),
    getWorkerDashboardSeries(workerId, range),
  ])

  const uniqueViews = await countUniqueViews(workerId, range)
  const previousUniqueViews = await countUniqueViews(workerId, previous)
  const earnings = tipAgg._sum.amount ?? 0
  const previousEarnings = previousTipAgg._sum.amount ?? 0

  return {
    worker: {
      id: worker.id,
      name: worker.name,
      category: worker.category.name,
      walletAddress: worker.walletAddress,
    },
    range: toRangePayload(range),
    summary: {
      totalViews: currentViews,
      uniqueViews,
      tipsReceived: earnings,
      tipCount: tipAgg._count,
      avgRating: reviewAgg._avg.rating ?? 0,
      reviewCount: reviewAgg._count,
      earnings,
      contacts,
    },
    deltas: {
      totalViews: calcGrowthPct(currentViews, previousViews),
      uniqueViews: calcGrowthPct(uniqueViews, previousUniqueViews),
      tipsReceived: calcGrowthPct(earnings, previousEarnings),
      avgRating: calcRatingDelta(reviewAgg._avg.rating, previousReviewAgg._avg.rating),
      earnings: calcGrowthPct(earnings, previousEarnings),
    },
    charts: {
      series,
      ratingDistribution: [5, 4, 3, 2, 1].map((rating) => {
        const item = ratingDistribution.find((r) => r.rating === rating)
        return { rating, count: item?._count.rating ?? 0 }
      }),
    },
  }
}

export async function getWorkerDashboardSeries(workerId: string, range: Required<DateRange>): Promise<TimeSeriesPoint[]> {
  const worker = await db.worker.findUnique({ where: { id: workerId }, select: { id: true } })
  if (!worker) throw new AppError('Worker not found', 404)

  const [views, tips, reviews] = await Promise.all([
    db.profileView.findMany({ where: { workerId, viewedAt: dateRangeWhere(range) }, select: { viewedAt: true, ip: true }, orderBy: { viewedAt: 'asc' } }),
    db.workerTipEvent.findMany({ where: { workerId, createdAt: dateRangeWhere(range) }, select: { amount: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
    db.review.findMany({ where: { workerId, status: 'approved', createdAt: dateRangeWhere(range) }, select: { rating: true, createdAt: true }, orderBy: { createdAt: 'asc' } }),
  ])

  const dailyMap = buildDailyMap(range)

  for (const view of views) {
    const key = dayKey(view.viewedAt)
    const point = dailyMap.get(key)
    if (point) point.views += 1
  }

  const uniqueIpsByDay = new Map<string, Set<string>>()
  for (const view of views) {
    const key = dayKey(view.viewedAt)
    if (!uniqueIpsByDay.has(key)) uniqueIpsByDay.set(key, new Set())
    uniqueIpsByDay.get(key)!.add(view.ip)
  }
  for (const [key, ips] of uniqueIpsByDay) {
    const point = dailyMap.get(key)
    if (point) point.uniqueViews = ips.size
  }

  for (const tip of tips) {
    const key = dayKey(tip.createdAt)
    const point = dailyMap.get(key)
    if (point) {
      point.tips += tip.amount
      point.earnings += tip.amount
      point.tipCount += 1
    }
  }

  const ratingsByDay = new Map<string, number[]>()
  for (const review of reviews) {
    const key = dayKey(review.createdAt)
    if (!ratingsByDay.has(key)) ratingsByDay.set(key, [])
    ratingsByDay.get(key)!.push(review.rating)
  }
  for (const [key, ratings] of ratingsByDay) {
    const point = dailyMap.get(key)
    if (point) {
      point.reviewCount = ratings.length
      point.avgRating = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
    }
  }

  return Array.from(dailyMap.values())
}

export async function exportPersonalWorkerAnalyticsCsv(workerId: string, range: Required<DateRange>) {
  const dashboard = await getWorkerPersonalDashboard(workerId, range)
  const lines = [
    'Date,Views,Unique Views,Tips (XLM),Tip Count,Average Rating,Review Count,Earnings (XLM)',
    ...dashboard.charts.series.map((p) => [
      p.date,
      p.views,
      p.uniqueViews,
      p.tips.toFixed(7),
      p.tipCount,
      p.avgRating == null ? '' : p.avgRating.toFixed(2),
      p.reviewCount,
      p.earnings.toFixed(7),
    ].join(',')),
    '',
    `Worker,${csvEscape(dashboard.worker.name)}`,
    `Category,${csvEscape(dashboard.worker.category)}`,
    `Range,${dashboard.range.startDate} to ${dashboard.range.endDate}`,
    `Total Views,${dashboard.summary.totalViews}`,
    `Unique Views,${dashboard.summary.uniqueViews}`,
    `Tips Received (XLM),${dashboard.summary.tipsReceived.toFixed(7)}`,
    `Tip Count,${dashboard.summary.tipCount}`,
    `Average Rating,${dashboard.summary.avgRating.toFixed(2)}`,
    `Review Count,${dashboard.summary.reviewCount}`,
    `Earnings (XLM),${dashboard.summary.earnings.toFixed(7)}`,
  ]
  return lines.join('\n')
}

function parseDateBoundary(value: unknown, boundary: 'start' | 'end'): Date | undefined {
  if (!value) return undefined
  const date = new Date(String(value))
  if (Number.isNaN(date.getTime())) throw new AppError(`Invalid ${boundary === 'start' ? 'startDate' : 'endDate'}`, 400)
  if (boundary === 'start') date.setUTCHours(0, 0, 0, 0)
  else date.setUTCHours(23, 59, 59, 999)
  return date
}

function dateRangeWhere(range: Required<DateRange>) {
  return { gte: range.startDate, lte: range.endDate }
}

function daysBefore(anchor: Date, days: number): Date {
  const d = new Date(anchor)
  d.setUTCDate(d.getUTCDate() - days)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

function getPreviousRange(range: Required<DateRange>): Required<DateRange> {
  const duration = range.endDate.getTime() - range.startDate.getTime()
  const endDate = new Date(range.startDate.getTime() - 1)
  const startDate = new Date(endDate.getTime() - duration)
  return { startDate, endDate }
}

function toRangePayload(range: Required<DateRange>) {
  return {
    startDate: dayKey(range.startDate),
    endDate: dayKey(range.endDate),
  }
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function buildDailyMap(range: Required<DateRange>): Map<string, TimeSeriesPoint> {
  const map = new Map<string, TimeSeriesPoint>()
  const cursor = new Date(range.startDate)
  cursor.setUTCHours(0, 0, 0, 0)
  const end = new Date(range.endDate)
  end.setUTCHours(0, 0, 0, 0)

  while (cursor <= end) {
    const date = dayKey(cursor)
    map.set(date, { date, views: 0, uniqueViews: 0, tips: 0, tipCount: 0, avgRating: null, reviewCount: 0, earnings: 0 })
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return map
}

async function countUniqueViews(workerId: string, range: Required<DateRange>) {
  const rows = await db.profileView.findMany({
    where: { workerId, viewedAt: dateRangeWhere(range) },
    select: { ip: true },
    distinct: ['ip'],
  })
  return rows.length
}

function calcRatingDelta(current: number | null, previous: number | null): number {
  return Math.round(((current ?? 0) - (previous ?? 0)) * 10) / 10
}
