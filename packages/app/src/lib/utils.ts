import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

let _locale = "en-US";

export function setLocale(locale: string) {
  _locale = locale === "en" ? "en-US" : locale === "pt" ? "pt-BR" : `${locale}-${locale.toUpperCase()}`;
}

export function getLocale(): string {
  return _locale;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(date).toLocaleDateString(_locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...opts,
  });
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + "…";
}

export function formatWalletAddress(address: string): string {
  if (address.length <= 8) return address;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

export function formatXLM(stroops: number | bigint): string {
  const xlm = Number(stroops) / 10_000_000;
  return `${xlm.toLocaleString(_locale, { minimumFractionDigits: 0, maximumFractionDigits: 7 })} XLM`;
}

export function formatCurrency(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat(_locale, { style: "currency", currency }).format(amount);
}

export function formatNumber(num: number, opts?: Intl.NumberFormatOptions): string {
  return num.toLocaleString(_locale, opts);
}
