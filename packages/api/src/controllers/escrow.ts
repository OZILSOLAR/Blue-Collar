import type { Request, Response } from 'express'
import { catchAsync } from '../utils/catchAsync.js'
import * as escrowService from '../services/escrow.service.js'

export const listEscrows = catchAsync(async (req: Request, res: Response) => {
  const { page, limit } = req.query as any
  const result = await escrowService.listEscrows(req.user!.id, req.user!.role, Number(page ?? 1), Number(limit ?? 20))
  return res.json({ ...result, status: 'success', code: 200 })
})

export const getEscrow = catchAsync(async (req: Request, res: Response) => {
  const record = await escrowService.getEscrow(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const createEscrow = catchAsync(async (req: Request, res: Response) => {
  const { jobId, payeeId, amountXlm, expiresAt, txId } = req.body
  if (!payeeId || !amountXlm || !expiresAt) {
    return res.status(400).json({ status: 'error', message: 'payeeId, amountXlm and expiresAt are required', code: 400 })
  }
  const record = await escrowService.createEscrow({
    jobId,
    payerId: req.user!.id,
    payeeId,
    amountXlm: Number(amountXlm),
    expiresAt: new Date(expiresAt),
    txId,
  })
  return res.status(201).json({ data: record, status: 'success', code: 201 })
})

export const activateEscrow = catchAsync(async (req: Request, res: Response) => {
  const { txId } = req.body
  if (!txId) return res.status(400).json({ status: 'error', message: 'txId is required', code: 400 })
  const record = await escrowService.activateEscrow(req.params.id, txId)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const releaseEscrow = catchAsync(async (req: Request, res: Response) => {
  const record = await escrowService.releaseEscrow(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const cancelEscrow = catchAsync(async (req: Request, res: Response) => {
  const record = await escrowService.cancelEscrow(req.params.id, req.user!.id, req.user!.role)
  return res.json({ data: record, status: 'success', code: 200 })
})

export const fileDispute = catchAsync(async (req: Request, res: Response) => {
  const { reason, evidence } = req.body
  if (!reason) return res.status(400).json({ status: 'error', message: 'reason is required', code: 400 })
  const dispute = await escrowService.fileEscrowDispute(req.params.id, req.user!.id, reason, evidence)
  return res.status(201).json({ data: dispute, status: 'success', code: 201 })
})

export const resolveDispute = catchAsync(async (req: Request, res: Response) => {
  const { status, resolution } = req.body
  if (!status || !['under_review', 'resolved', 'dismissed'].includes(status)) {
    return res.status(400).json({ status: 'error', message: 'status must be under_review, resolved, or dismissed', code: 400 })
  }
  const dispute = await escrowService.resolveEscrowDispute(req.params.disputeId, req.user!.id, status, resolution)
  return res.json({ data: dispute, status: 'success', code: 200 })
})
