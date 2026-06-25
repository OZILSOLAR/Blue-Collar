import { db } from '../db.js'
import { AppError } from './AppError.js'

export async function create(data: {
  userId: string
  type: string
  title: string
  message?: string
  href?: string
}) {
  return db.notification.create({ data })
}

export async function listByUser(userId: string, page: number, limit: number) {
  const where = { userId }
  const [data, total] = await Promise.all([
    db.notification.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    db.notification.count({ where }),
  ])
  return { data, meta: { total, page, limit, pages: Math.ceil(total / limit) } }
}

export async function unreadCount(userId: string) {
  return db.notification.count({ where: { userId, read: false } })
}

export async function markAsRead(id: string, userId: string) {
  const notification = await db.notification.findUnique({ where: { id } })
  if (!notification || notification.userId !== userId) {
    throw new AppError('Notification not found', 404)
  }
  return db.notification.update({ where: { id }, data: { read: true } })
}

export async function markAllAsRead(userId: string) {
  const result = await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  })
  return result.count
}

export async function remove(id: string, userId: string) {
  const notification = await db.notification.findUnique({ where: { id } })
  if (!notification || notification.userId !== userId) {
    throw new AppError('Notification not found', 404)
  }
  await db.notification.delete({ where: { id } })
}
