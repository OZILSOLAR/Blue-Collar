import { AppError, ErrorCode } from '../utils/AppError.js'
import { getTraceId } from '../monitoring/tracing.js'

export interface ErrorResponse {
  status: 'error'
  message: string
  code: number
  errorCode: ErrorCode
  traceId?: string
  stack?: string
  originalMessage?: string
}

interface PrismaClientKnownRequestError {
  code: string
  meta?: Record<string, unknown>
}

function isPrismaError(err: unknown): err is PrismaClientKnownRequestError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    typeof (err as Record<string, unknown>).code === 'string' &&
    (err as Record<string, unknown>).code?.toString().startsWith('P')
  )
}

function mapPrismaError(err: PrismaClientKnownRequestError): { statusCode: number; message: string; errorCode: ErrorCode } {
  switch (err.code) {
    case 'P2002': return { statusCode: 409, message: 'A record with that value already exists', errorCode: ErrorCode.CONFLICT }
    case 'P2025': return { statusCode: 404, message: 'Record not found', errorCode: ErrorCode.NOT_FOUND }
    case 'P2003': return { statusCode: 400, message: 'Related record not found', errorCode: ErrorCode.VALIDATION_ERROR }
    default:      return { statusCode: 500, message: 'Database error', errorCode: ErrorCode.INTERNAL_ERROR }
  }
}

export interface SerializedError {
  statusCode: number
  body: ErrorResponse
}

export function serializeError(err: unknown): SerializedError {
  const traceId = getTraceId()

  if (err instanceof Error && err.message.startsWith('CORS:')) {
    return {
      statusCode: 403,
      body: { status: 'error', message: 'Forbidden: origin not allowed', code: 403, errorCode: ErrorCode.FORBIDDEN },
    }
  }

  if (isPrismaError(err)) {
    const { statusCode, message, errorCode } = mapPrismaError(err)
    return { statusCode, body: { status: 'error', message, code: statusCode, errorCode, traceId } }
  }

  if (err instanceof AppError && err.isOperational) {
    return {
      statusCode: err.statusCode,
      body: { status: 'error', message: err.message, code: err.statusCode, errorCode: err.errorCode, traceId },
    }
  }

  const error = err instanceof Error ? err : new Error(String(err))
  const body: ErrorResponse = {
    status: 'error',
    message: 'Internal Server Error',
    code: 500,
    errorCode: ErrorCode.INTERNAL_ERROR,
    traceId,
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack, originalMessage: error.message }),
  }
  return { statusCode: 500, body }
}
