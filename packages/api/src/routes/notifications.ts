import { Router } from 'express'
import {
  listNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
  deleteNotification,
} from '../controllers/notifications.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

router.get('/', listNotifications)
router.get('/unread-count', getUnreadCount)
router.patch('/:id/read', markRead)
router.patch('/read-all', markAllRead)
router.delete('/:id', deleteNotification)

export default router
