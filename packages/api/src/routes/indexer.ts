import { Router } from 'express'
import * as indexerController from '../controllers/indexer.js'

const router = Router()

// Query indexed events
router.get('/', indexerController.queryEvents)
router.get('/worker-registrations/:contractId/:ownerAddress', indexerController.getWorkerRegistrations)
router.get('/cursor/:contractId', indexerController.getCursor)

export default router
