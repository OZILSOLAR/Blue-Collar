import { db } from '../db.js'
import { AppError } from '../utils/AppError.js'

interface ContractEventData {
  contractId: string
  eventName: string
  ledger: bigint
  txIndex: number
  eventIndex: number
  indexed: Record<string, unknown>
  data?: Record<string, unknown>
}

/**
 * Ingest a contract event idempotently.
 * Uses unique constraint on (contractId, ledger, txIndex, eventIndex) to prevent duplicates.
 */
export async function ingestContractEvent(event: ContractEventData) {
  return db.contractEvent.upsert({
    where: {
      contractId_ledger_txIndex_eventIndex: {
        contractId: event.contractId,
        ledger: event.ledger,
        txIndex: event.txIndex,
        eventIndex: event.eventIndex,
      },
    },
    update: {
      processedAt: new Date(),
    },
    create: {
      contractId: event.contractId,
      eventName: event.eventName,
      ledger: event.ledger,
      txIndex: event.txIndex,
      eventIndex: event.eventIndex,
      indexed: event.indexed,
      data: event.data,
    },
  })
}

/**
 * Get or create the indexer cursor for a contract.
 * Tracks the last ledger/txIndex processed to enable safe restarts.
 */
export async function getOrCreateCursor(contractId: string) {
  return db.eventIndexerCursor.upsert({
    where: { contractId },
    update: {},
    create: {
      contractId,
      ledger: BigInt(0),
      txIndex: 0,
    },
  })
}

/**
 * Update the indexer cursor after processing events.
 * Only updates if the new cursor is ahead of the current one.
 */
export async function updateCursor(
  contractId: string,
  ledger: bigint,
  txIndex: number,
) {
  const current = await db.eventIndexerCursor.findUnique({
    where: { contractId },
  })

  if (!current) {
    throw new AppError('Cursor not found for contract', 404)
  }

  // Only update if we're moving forward
  if (ledger > current.ledger || (ledger === current.ledger && txIndex > current.txIndex)) {
    return db.eventIndexerCursor.update({
      where: { contractId },
      data: {
        ledger,
        txIndex,
        updatedAt: new Date(),
      },
    })
  }

  return current
}

/**
 * Query indexed events by contract and event name.
 * Supports pagination for fast REST API responses.
 */
export async function queryEvents(
  contractId: string,
  eventName?: string,
  limit = 50,
  offset = 0,
) {
  const where: { contractId: string; eventName?: string } = { contractId }
  if (eventName) where.eventName = eventName

  const [events, total] = await Promise.all([
    db.contractEvent.findMany({
      where,
      orderBy: { ledger: 'desc' },
      take: limit,
      skip: offset,
    }),
    db.contractEvent.count({ where }),
  ])

  return { events, total, limit, offset }
}

/**
 * Get worker registration events by owner address.
 */
export async function getWorkerRegistrationEvents(
  contractId: string,
  ownerAddress: string,
) {
  return db.contractEvent.findMany({
    where: {
      contractId,
      eventName: 'WrkReg',
      indexed: {
        path: ['owner'],
        equals: ownerAddress,
      },
    },
    orderBy: { ledger: 'desc' },
  })
}

/**
 * Reconcile events on startup: scan for gaps and update cursor if needed.
 * Called after restart to ensure no events are missed.
 */
export async function reconcileEvents(contractId: string) {
  const cursor = await getOrCreateCursor(contractId)

  // Find the last ingested event
  const lastEvent = await db.contractEvent.findFirst({
    where: { contractId },
    orderBy: { ledger: 'desc' },
  })

  if (lastEvent && lastEvent.ledger > cursor.ledger) {
    await updateCursor(contractId, lastEvent.ledger, lastEvent.txIndex)
  }

  return cursor
}

/**
 * Clean up old events beyond retention period (for storage optimization).
 * Keeps events for the last N days (default: 90 days).
 */
export async function cleanupOldEvents(contractId: string, retentionDays = 90) {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays)

  return db.contractEvent.deleteMany({
    where: {
      contractId,
      createdAt: { lt: cutoffDate },
    },
  })
}
