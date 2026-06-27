import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import argon2 from 'argon2'
import { z } from 'zod'
import { db } from '../db.js'
import { sendVerificationEmail } from '../mailer/index.js'
import { sanitizeUser } from '../models/user.model.js'
import { AppError } from './AppError.js'
import { createServiceLogger } from '../utils/logger.js'

const logger = createServiceLogger('UserService')

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(50).optional(),
  lastName: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
})

function generateVerificationToken(userId: string) {
  const raw = jwt.sign({ id: userId, purpose: 'email-verify' }, process.env.JWT_SECRET!, {
    expiresIn: '24h',
  })
  const hash = crypto.createHash('sha256').update(raw).digest('hex')
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000)
  return { raw, hash, expiry }
}

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  logger.debug('Updating user profile', { userId })
  const parsed = updateProfileSchema.parse(input)
  const current = await db.user.findUnique({ where: { id: userId } })
  if (!current) {
    logger.warn('Profile update failed: user not found', { userId })
    throw new AppError('User not found', 404)
  }

  const emailChanged = parsed.email !== undefined && parsed.email !== current.email
  const verification = emailChanged ? generateVerificationToken(userId) : null

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      ...parsed,
      ...(emailChanged
        ? {
            verified: false,
            verificationToken: verification!.hash,
            verificationTokenExpiry: verification!.expiry,
          }
        : {}),
    },
  })

  if (emailChanged) {
    logger.info('Email changed, verification email sent', { userId, newEmail: updated.email })
    await sendVerificationEmail(updated.email, updated.firstName, verification!.raw)
  } else {
    logger.info('User profile updated successfully', { userId })
  }

  return sanitizeUser(updated)
}

/** Change a user's password. Verifies the current password before updating. */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  if (newPassword.length < 8) throw new AppError('Password must be at least 8 characters', 400)

  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user || !user.password) throw new AppError('No password set on this account', 400)

  const valid = await argon2.verify(user.password, currentPassword)
  if (!valid) throw new AppError('Current password is incorrect', 400)

  const hashed = await argon2.hash(newPassword)
  await db.user.update({ where: { id: userId }, data: { password: hashed } })
  logger.info('Password changed', { userId })
}

/** Permanently delete a user account. */
export async function deleteAccount(userId: string): Promise<void> {
  await db.user.delete({ where: { id: userId } })
  logger.info('Account deleted', { userId })
}

export interface PushSubscriptionInput {
  endpoint: string
  keys: { auth: string; p256dh: string }
}

/** Register or update a web push subscription for a user. */
export async function savePushSubscription(userId: string, input: PushSubscriptionInput) {
  const { endpoint, keys } = input
  return db.pushSubscription.upsert({
    where: { userId_endpoint: { userId, endpoint } },
    update: { auth: keys.auth, p256dh: keys.p256dh },
    create: { userId, endpoint, auth: keys.auth, p256dh: keys.p256dh },
  })
}

/** Remove a push subscription endpoint for a user. */
export async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  await db.pushSubscription.delete({ where: { userId_endpoint: { userId, endpoint } } })
}

/** Mark onboarding as completed for a user. */
export async function completeOnboarding(userId: string) {
  const user = await db.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  })
  return sanitizeUser(user)
}
