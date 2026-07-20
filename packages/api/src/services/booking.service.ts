import { db } from '../db.js'
import { AppError } from './AppError.js'

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed'

const VALID_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['cancelled', 'completed'],
  cancelled: [],
  completed: [],
}

async function checkOverlap(workerId: string, startTime: Date, endTime: Date, excludeId?: string) {
  const overlapping = await db.booking.findFirst({
    where: {
      workerId,
      id: excludeId ? { not: excludeId } : undefined,
      status: { in: ['pending', 'confirmed'] },
      startTime: { lt: endTime },
      endTime: { gt: startTime },
    },
  })
  return !!overlapping
}

function assertValidDate(date: Date, label: string) {
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Invalid ${label} format`, 400)
  }
}

export async function createBooking(data: {
  workerId: string
  requesterId: string
  startTime: string
  endTime: string
}) {
  const startTime = new Date(data.startTime)
  const endTime = new Date(data.endTime)

  assertValidDate(startTime, 'startTime')
  assertValidDate(endTime, 'endTime')

  if (startTime >= endTime) {
    throw new AppError('startTime must be before endTime', 400)
  }

  if (startTime < new Date()) {
    throw new AppError('Cannot book a time in the past', 400)
  }

  const worker = await db.worker.findUnique({ where: { id: data.workerId } })
  if (!worker) {
    throw new AppError('Worker not found', 404)
  }

  const hasOverlap = await checkOverlap(data.workerId, startTime, endTime)
  if (hasOverlap) {
    throw new AppError('This time slot overlaps with an existing booking', 409)
  }

  return db.booking.create({
    data: {
      workerId: data.workerId,
      requesterId: data.requesterId,
      startTime,
      endTime,
      status: 'pending',
    },
    include: { worker: true, requester: true },
  })
}

export async function confirmBooking(bookingId: string, userId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } })
  if (!booking) {
    throw new AppError('Booking not found', 404)
  }

  const worker = await db.worker.findUnique({ where: { id: booking.workerId } })
  if (!worker) {
    throw new AppError('Worker not found', 404)
  }

  if (worker.curatorId !== userId) {
    throw new AppError('Unauthorized', 403)
  }

  if (!VALID_TRANSITIONS[booking.status as BookingStatus].includes('confirmed')) {
    throw new AppError('Only pending bookings can be confirmed', 400)
  }

  return db.booking.update({
    where: { id: bookingId },
    data: { status: 'confirmed' },
    include: { worker: true, requester: true },
  })
}

export async function cancelBooking(bookingId: string, userId: string) {
  const booking = await db.booking.findUnique({ where: { id: bookingId } })
  if (!booking) {
    throw new AppError('Booking not found', 404)
  }

  const worker = await db.worker.findUnique({ where: { id: booking.workerId } })
  const isWorkerCurator = worker?.curatorId === userId
  const isRequester = booking.requesterId === userId

  if (!isWorkerCurator && !isRequester) {
    throw new AppError('Unauthorized', 403)
  }

  if (!VALID_TRANSITIONS[booking.status as BookingStatus].includes('cancelled')) {
    throw new AppError('This booking cannot be cancelled', 400)
  }

  return db.booking.update({
    where: { id: bookingId },
    data: { status: 'cancelled' },
    include: { worker: true, requester: true },
  })
}

export async function listMyBookings(userId: string, role?: string, status?: string) {
  let where: any = {}

  if (role === 'worker') {
    const workerIds = (
      await db.worker.findMany({
        where: { curatorId: userId },
        select: { id: true },
      })
    ).map((w) => w.id)
    where.workerId = { in: workerIds }
  } else if (role === 'requester') {
    where.requesterId = userId
  } else {
    const workerIds = (
      await db.worker.findMany({
        where: { curatorId: userId },
        select: { id: true },
      })
    ).map((w) => w.id)
    where.OR = [{ requesterId: userId }, { workerId: { in: workerIds } }]
  }

  if (status) {
    where.status = status
  }

  return db.booking.findMany({
    where,
    include: { worker: true, requester: true },
    orderBy: { startTime: 'asc' },
  })
}
