/**
 * Thin wrapper around sonner so callers don't import sonner directly.
 * Supports success, error, warning, and info variants.
 * Also provides helpers for API error toasts.
 */
import { toast as sonnerToast } from "sonner";
import { parseApiError } from "@/lib/errors";

export type ToastType = "success" | "error" | "warning" | "info";

export function useToast() {
  const toast = (message: string, type: ToastType = "success") => {
    sonnerToast[type](message);
  };

  const fromApiError = (error: unknown, fallback?: string) => {
    const parsed = parseApiError(error, fallback);
    sonnerToast[parsed.toastType](parsed.message, {
      description: parsed.code ? `Error: ${parsed.code}` : undefined,
      action: parsed.retryable
        ? {
            label: "Retry",
            onClick: () => window.location.reload(),
          }
        : undefined,
    });
    return parsed;
  };

  return { toast, fromApiError };
}
