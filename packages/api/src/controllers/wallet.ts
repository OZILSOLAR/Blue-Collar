import { Request, Response } from 'express'
import * as walletService from '../services/wallet.service.js'
import { catchAsync } from '../utils/catchAsync.js'
import { validateRequest } from '../middleware/validate.js'
import { z } from 'zod'

// Validation schemas
const linkWalletSchema = z.object({
  publicKey: z.string().min(56).max(56),
})

const pollTxSchema = z.object({
  txHash: z.string(),
})

/**
 * GET /api/wallet/balance
 * Get current balance for authenticated user's Stellar account
 */
export const getBalance = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const data = await walletService.getUserBalance(userId)

  res.json({
    status: 'success',
    code: 200,
    data,
  })
})

/**
 * GET /api/wallet/account/:publicKey
 * Get account info (balance, sequence) from Horizon
 */
export const getAccountInfo = catchAsync(async (req: Request, res: Response) => {
  const { publicKey } = req.params

  const data = await walletService.getAccountInfo(publicKey)

  res.json({
    status: 'success',
    code: 200,
    data,
  })
})

/**
 * POST /api/wallet/link
 * Link a Stellar wallet to the authenticated user
 */
export const linkWallet = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user?.id
  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const validated = validateRequest(req.body, linkWalletSchema)
  const account = await walletService.linkStellarAccount(userId, validated.publicKey)

  res.status(201).json({
    status: 'success',
    code: 201,
    message: 'Wallet linked successfully',
    data: account,
  })
})

/**
 * POST /api/wallet/build-tx
 * Build unsigned transaction for tip/escrow
 */
export const buildTransaction = catchAsync(async (req: Request, res: Response) => {
  const { sourcePublicKey, destinationPublicKey, amount, memo } = req.body

  if (!sourcePublicKey || !destinationPublicKey || !amount) {
    return res.status(400).json({
      status: 'error',
      code: 400,
      message: 'Missing required fields',
    })
  }

  const tx = await walletService.buildUnsignedTx(
    sourcePublicKey,
    destinationPublicKey,
    amount,
    memo,
  )

  res.json({
    status: 'success',
    code: 200,
    data: tx,
  })
})

/**
 * POST /api/wallet/broadcast
 * Broadcast a signed transaction to Stellar network
 */
export const broadcastTx = catchAsync(async (req: Request, res: Response) => {
  const { signedXdr } = req.body

  if (!signedXdr) {
    return res.status(400).json({
      status: 'error',
      code: 400,
      message: 'signedXdr is required',
    })
  }

  const result = await walletService.broadcastTransaction(signedXdr)

  res.json({
    status: 'success',
    code: 200,
    data: result,
  })
})

/**
 * GET /api/wallet/tx-status/:txHash
 * Poll transaction status
 */
export const getTxStatus = catchAsync(async (req: Request, res: Response) => {
  const { txHash } = req.params

  const status = await walletService.pollTransactionStatus(txHash)

  res.json({
    status: 'success',
    code: 200,
    data: status,
  })
})

/**
 * POST /api/wallet/testnet-fund
 * Fund testnet account via friendbot
 */
export const fundTestnet = catchAsync(async (req: Request, res: Response) => {
  const { publicKey } = req.body

  if (!publicKey) {
    return res.status(400).json({
      status: 'error',
      code: 400,
      message: 'publicKey is required',
    })
  }

  const result = await walletService.fundTestnetAccount(publicKey)

  res.json({
    status: 'success',
    code: 200,
    data: result,
  })
})

/**
 * GET /api/wallet/transactions/:publicKey
 * Get account transactions from Horizon
 */
export const getTransactions = catchAsync(async (req: Request, res: Response) => {
  const { publicKey } = req.params
  const { limit = '50', order = 'desc' } = req.query

  const transactions = await walletService.getAccountTransactions(
    publicKey,
    parseInt(limit as string),
    (order as 'asc' | 'desc') || 'desc',
  )

  res.json({
    status: 'success',
    code: 200,
    data: transactions,
  })
})
