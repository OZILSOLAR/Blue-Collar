import { Router } from 'express'
import { createBooking, confirmBooking, cancelBooking, listMyBookings } from '../controllers/bookings.js'
import { authenticate } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { createBookingRules, listMyBookingsQuery } from '../validations/booking.js'
import { userRateLimit } from '../middleware/userRateLimit.js'

const router = Router()

const bookingRateLimit = userRateLimit({
  windowSec: 3600,
  anonLimit: 0,
  authLimit: 10,
})

router.post('/', authenticate, bookingRateLimit, validate(createBookingRules), createBooking)
router.get('/mine', authenticate, validate(listMyBookingsQuery, 'query'), listMyBookings)
router.patch('/:id/confirm', authenticate, confirmBooking)
router.patch('/:id/cancel', authenticate, cancelBooking)

export default router
