import type { Request, Response } from 'express'
import * as bookingService from '../services/booking.service.js'
import { handleError } from '../utils/handleError.js'

export async function createBooking(req: Request, res: Response) {
  try {
    const booking = await bookingService.createBooking({
      workerId: req.body.workerId,
      requesterId: req.user!.id,
      startTime: req.body.startTime,
      endTime: req.body.endTime,
    })
    return res.status(201).json({ status: 'success', data: booking, code: 201 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function confirmBooking(req: Request, res: Response) {
  try {
    const booking = await bookingService.confirmBooking(req.params.id, req.user!.id)
    return res.status(200).json({ status: 'success', data: booking, code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function cancelBooking(req: Request, res: Response) {
  try {
    const booking = await bookingService.cancelBooking(req.params.id, req.user!.id)
    return res.status(200).json({ status: 'success', data: booking, code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}

export async function listMyBookings(req: Request, res: Response) {
  try {
    const bookings = await bookingService.listMyBookings(
      req.user!.id,
      req.query.role as string | undefined,
      req.query.status as string | undefined,
    )
    return res.status(200).json({ status: 'success', data: bookings, code: 200 })
  } catch (err) {
    return handleError(res, err)
  }
}
