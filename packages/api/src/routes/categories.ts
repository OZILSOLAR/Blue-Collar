import { Router } from 'express'
import { listCategories, getCategory, createCategory, updateCategory, deleteCategory } from '../controllers/categories.js'
import { cacheMiddleware, TTL } from '../middleware/cache.js'
import { authenticate, authorize } from '../middleware/auth.js'

const router = Router()

router.get('/', cacheMiddleware(TTL.HOUR), listCategories)
router.get('/:id', cacheMiddleware(TTL.HOUR), getCategory)

router.post('/', authenticate, authorize('admin'), createCategory)
router.put('/:id', authenticate, authorize('admin'), updateCategory)
router.delete('/:id', authenticate, authorize('admin'), deleteCategory)

export default router
