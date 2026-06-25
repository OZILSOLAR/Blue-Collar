import { toast as sonnerToast } from "sonner";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface ToastOptions {
  duration?: number;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useToast() {
  function toast(message: string, type?: ToastType, options?: ToastOptions) {
    if (type === "loading") {
      const id = sonnerToast.loading(message, {
        description: options?.description,
        duration: options?.duration ?? Infinity,
      });
      return {
        id,
        dismiss: () => sonnerToast.dismiss(id),
        update: (newMsg: string, newType?: ToastType) => {
          sonnerToast.dismiss(id);
          sonnerToast[newType ?? "info"](newMsg);
        },
      };
    }
    sonnerToast[type ?? "success"](message, {
      description: options?.description,
      duration: options?.duration,
      action: options?.action,
    });
    return undefined;
  }

  function dismiss(id?: string) {
    sonnerToast.dismiss(id);
  }

  return { toast, dismiss };
}
