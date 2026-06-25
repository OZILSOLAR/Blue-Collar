import type { Request, Response } from 'express'
import * as notificationService from '../services/notification.service.js'
import { handleError } from '../utils/handleError.js'

export async function listNotifications(req: Request, res: Response) {
  try {
    const page = Number(req.query.page ?? 1)
    const limit = Math.min(Number(req.query.limit ?? 20), 50)
    const result = await notificationService.listByUser(req.user!.id, page, limit)
    return res.json({ ...result, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function getUnreadCount(req: Request, res: Response) {
  try {
    const count = await notificationService.unreadCount(req.user!.id)
    return res.json({ data: { count }, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function markRead(req: Request, res: Response) {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user!.id)
    return res.json({ data: notification, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function markAllRead(req: Request, res: Response) {
  try {
    const count = await notificationService.markAllAsRead(req.user!.id)
    return res.json({ data: { count }, status: 'success', code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function deleteNotification(req: Request, res: Response) {
  try {
    await notificationService.remove(req.params.id, req.user!.id)
    return res.status(204).send()
  } catch (err) {
    return handleError(res, err)
  }
}
