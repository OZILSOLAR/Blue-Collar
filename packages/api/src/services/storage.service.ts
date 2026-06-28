/**
 * S3-compatible object storage service.
 * Uses the AWS SDK v3 S3Client so it works with AWS S3, MinIO, Cloudflare R2, etc.
 * Falls back to local disk storage when S3_BUCKET is not configured (dev/test).
 */
import { createReadStream, existsSync } from 'node:fs'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { logger } from '../config/logger.js'

// ── Lazy S3 import (optional dep — graceful fallback) ─────────────────────────
let s3Client: any = null
let PutObjectCommand: any = null
let GetObjectCommand: any = null
let DeleteObjectCommand: any = null
let getSignedUrl: any = null

async function getS3() {
  if (s3Client) return { s3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl }
  try {
    const s3Module = await import('@aws-sdk/client-s3')
    const signModule = await import('@aws-sdk/s3-request-presigner')
    PutObjectCommand = s3Module.PutObjectCommand
    GetObjectCommand = s3Module.GetObjectCommand
    DeleteObjectCommand = s3Module.DeleteObjectCommand
    getSignedUrl = signModule.getSignedUrl
    s3Client = new s3Module.S3Client({
      region: process.env['S3_REGION'] ?? 'us-east-1',
      endpoint: process.env['S3_ENDPOINT'],           // for MinIO / R2
      forcePathStyle: !!process.env['S3_ENDPOINT'],   // required for MinIO
      credentials: process.env['S3_ACCESS_KEY']
        ? { accessKeyId: process.env['S3_ACCESS_KEY']!, secretAccessKey: process.env['S3_SECRET_KEY']! }
        : undefined,                                  // falls back to IAM role / env chain
    })
    return { s3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, getSignedUrl }
  } catch {
    return null
  }
}

const BUCKET = process.env['S3_BUCKET'] ?? ''
const SIGNED_URL_TTL = Number(process.env['S3_SIGNED_URL_TTL'] ?? 3600) // seconds

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Upload a local file to S3 and return its storage key.
 * Falls back to returning a local URL path when S3 is not configured.
 */
export async function uploadFile(localPath: string, key: string, contentType: string): Promise<string> {
  if (!BUCKET) {
    // Local fallback — key is the relative path from storage/uploads
    logger.info({ key }, 'S3 not configured — using local storage')
    return `/uploads/${path.basename(localPath)}`
  }

  const sdk = await getS3()
  if (!sdk) throw new Error('S3 SDK not available. Install @aws-sdk/client-s3.')

  const { s3Client: client, PutObjectCommand: Put } = sdk
  const stream = createReadStream(localPath)
  await client.send(new Put({ Bucket: BUCKET, Key: key, Body: stream, ContentType: contentType }))

  // Remove the local temp file after successful upload
  if (existsSync(localPath)) await unlink(localPath).catch(() => {})

  return key
}

/**
 * Generate a pre-signed GET URL for a stored object.
 * If the key starts with `/uploads/` (local fallback) it is returned as-is.
 */
export async function getSignedDownloadUrl(key: string): Promise<string> {
  if (!BUCKET || key.startsWith('/uploads/')) return key

  const sdk = await getS3()
  if (!sdk) return key

  const { s3Client: client, GetObjectCommand: Get, getSignedUrl: sign } = sdk
  return sign(client, new Get({ Bucket: BUCKET, Key: key }), { expiresIn: SIGNED_URL_TTL })
}

/**
 * Delete an object from S3 (or log a warning for local files).
 */
export async function deleteFile(key: string): Promise<void> {
  if (!BUCKET || key.startsWith('/uploads/')) {
    logger.warn({ key }, 'deleteFile called for local path — file not removed automatically')
    return
  }

  const sdk = await getS3()
  if (!sdk) return

  const { s3Client: client, DeleteObjectCommand: Del } = sdk
  await client.send(new Del({ Bucket: BUCKET, Key: key }))
}
