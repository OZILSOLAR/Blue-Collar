import type { Request, Response } from 'express'
import { db } from '../db.js'

export async function toggleHelpful(req: Request, res: Response) {
  const { reviewId } = req.params
  const userId = req.user!.id

  const existing = await db.reviewHelpful.findUnique({
    where: { reviewId_userId: { reviewId, userId } },
  })

  if (existing) {
    await db.reviewHelpful.delete({ where: { id: existing.id } })
    const count = await db.reviewHelpful.count({ where: { reviewId } })
    return res.json({ data: { helpful: false, count }, status: 'success', code: 200 })
  }

  await db.reviewHelpful.create({ data: { reviewId, userId } })
  const count = await db.reviewHelpful.count({ where: { reviewId } })
  return res.json({ data: { helpful: true, count }, status: 'success', code: 201 })
}
