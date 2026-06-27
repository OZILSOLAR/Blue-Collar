import type { Request, Response } from 'express'
import * as notificationService from '../services/notification.service.js'
import { handleError } from '../utils/handleError.js'
import { db } from '../db.js'
import { catchAsync } from '../utils/catchAsync.js'

interface AuthRequest extends Request {
  user?: { id: string }
}

export async function listNotifications(req: AuthRequest, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const result = await db.notification.findMany({
      where: { userId: req.user!.id },
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    const total = await db.notification.count({ where: { userId: req.user!.id } })
    return res.json({
      data: result,
      meta: { total, page, limit, pages: Math.ceil(total / limit) },
      status: 'success',
      code: 200,
    })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getUnreadCount(req: AuthRequest, res: Response) {
  try {
    const count = await db.notification.count({
      where: { userId: req.user!.id, read: false },
    })
    return res.json({ data: { count }, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function markRead(req: AuthRequest, res: Response) {
  try {
    const notification = await db.notification.findUnique({ where: { id: req.params.id } })
    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ status: 'error', message: 'Not found' })
    }
    const updated = await db.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    })
    return res.json({ data: updated, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function markAllRead(req: AuthRequest, res: Response) {
  try {
    const result = await db.notification.updateMany({
      where: { userId: req.user!.id, read: false },
      data: { read: true },
    })
    return res.json({ data: { count: result.count }, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function deleteNotification(req: AuthRequest, res: Response) {
  try {
    const notification = await db.notification.findUnique({ where: { id: req.params.id } })
    if (!notification || notification.userId !== req.user!.id) {
      return res.status(404).json({ status: 'error', message: 'Not found' })
    }
    await db.notification.delete({ where: { id: req.params.id } })
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}

export const getPreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const prefs = await db.notificationPreferences.findUnique({
    where: { userId: req.user!.id },
  })
  res.json({
    data: prefs || {
      newWorkerNearby: true,
      statusChange: true,
      reviewReply: true,
      announcements: true,
    },
    status: 'success',
  })
})

export const updatePreferences = catchAsync(async (req: AuthRequest, res: Response) => {
  const { newWorkerNearby, statusChange, reviewReply, announcements } = req.body
  await notificationService.updateNotificationPreferences(req.user!.id, {
    newWorkerNearby,
    statusChange,
    reviewReply,
    announcements,
  })
  res.json({ status: 'success', message: 'Preferences updated' })
})

export const dispatchMultiChannel = catchAsync(async (req: AuthRequest, res: Response) => {
  const { type, title, message, channels, href } = req.body
  await notificationService.dispatchNotification({
    userId: req.user!.id,
    type,
    title,
    message,
    channels,
    href,
  })
  res.status(201).json({ status: 'success', message: 'Notification dispatched' })
})

export const getDeliveryLog = catchAsync(async (req: AuthRequest, res: Response) => {
  const log = await notificationService.getDeliveryLog(req.params.notificationId)
  if (!log) {
    return res.status(404).json({ status: 'error', message: 'Not found' })
  }
  res.json({ data: log, status: 'success' })
})
