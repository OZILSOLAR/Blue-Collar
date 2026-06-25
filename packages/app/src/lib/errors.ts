/**
 * Centralised API error parsing into user-facing messages.
 */
import type { ToastType } from "@/hooks/useToast";

export interface ParsedApiError {
  message: string;
  toastType: ToastType;
  code?: string;
  status?: number;
  retryable: boolean;
}

const NETWORK_ERRORS = [
  "Failed to fetch",
  "NetworkError",
  "Network request failed",
  "Load failed",
  "TypeError: Failed to fetch",
  "TypeError: NetworkError",
  "ERR_NETWORK",
  "ERR_CONNECTION_REFUSED",
  "ECONNREFUSED",
  "ERR_INTERNET_DISCONNECTED",
];

const RATE_LIMIT_PATTERNS = [
  "429",
  "Too Many Requests",
  "rate limit",
  "too many requests",
];

export function parseApiError(error: unknown, fallback?: string): ParsedApiError {
  const message = error instanceof Error ? error.message : String(error ?? "");

  // Network / connectivity errors
  if (NETWORK_ERRORS.some((e) => message.includes(e))) {
    return {
      message: "Unable to connect. Please check your internet connection.",
      toastType: "error",
      code: "NETWORK_ERROR",
      retryable: true,
    };
  }

  // Rate limiting
  if (RATE_LIMIT_PATTERNS.some((p) => message.includes(p))) {
    return {
      message: "You're doing that too often. Please wait a moment and try again.",
      toastType: "warning",
      code: "RATE_LIMITED",
      retryable: true,
    };
  }

  // Authentication errors
  if (message.includes("401") || message.includes("Unauthorized") || message.includes("Unauthenticated")) {
    return {
      message: "Your session has expired. Please log in again.",
      toastType: "error",
      code: "UNAUTHORIZED",
      status: 401,
      retryable: false,
    };
  }

  // Not found
  if (message.includes("404") || message.includes("Not found") || message.includes("not found")) {
    return {
      message: "The requested resource was not found.",
      toastType: "error",
      code: "NOT_FOUND",
      status: 404,
      retryable: false,
    };
  }

  // Validation / bad request
  if (message.includes("400") || message.includes("Validation") || message.includes("validation")) {
    return {
      message: "Please check your input and try again.",
      toastType: "warning",
      code: "VALIDATION_ERROR",
      status: 400,
      retryable: false,
    };
  }

  // Conflict
  if (message.includes("409") || message.includes("Conflict")) {
    return {
      message: "This action conflicts with the current state. Please refresh and try again.",
      toastType: "warning",
      code: "CONFLICT",
      status: 409,
      retryable: true,
    };
  }

  // Server errors
  if (message.includes("500") || message.includes("Internal Server Error")) {
    return {
      message: "Something went wrong on our end. Please try again later.",
      toastType: "error",
      code: "SERVER_ERROR",
      status: 500,
      retryable: true,
    };
  }

  // Default
  return {
    message: fallback ?? "An unexpected error occurred. Please try again.",
    toastType: "error",
    code: "UNKNOWN",
    retryable: true,
  };
}

export function isRetryable(error: unknown): boolean {
  return parseApiError(error).retryable;
}

export function formatErrorMessage(error: unknown, fallback?: string): string {
  return parseApiError(error, fallback).message;
}
