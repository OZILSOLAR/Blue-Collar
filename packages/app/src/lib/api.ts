/**
 * Centralized API client.
 * Automatically attaches the JWT from localStorage, handles 401s by
 * clearing auth state and redirecting to /auth/login.
 */

import type {
  Worker,
  Category,
  ApiResponse,
  Meta,
  Review,
  RatingDistributionEntry,
  WorkerAnalytics,
  CuratorAnalytics,
  PlatformAnalytics,
  ViewTrend,
  TopWorker,
  WorkerPersonalDashboard,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const TOKEN_KEY = "bc_token";

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Skip JSON serialisation — used for FormData uploads */
  rawBody?: BodyInit;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, rawBody, headers: extraHeaders, ...rest } = options;

  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;

  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(extraHeaders as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, {
    ...rest,
    headers,
    body: rawBody ?? (body !== undefined ? JSON.stringify(body) : undefined),
  });

  // 401 — clear token and redirect to login
  if (res.status === 401 && typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/auth/login";
    throw new Error("Unauthorized");
  }

  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((json as { message?: string }).message ?? "Request failed");
  return json as T;
}

// ─── Typed endpoint functions ─────────────────────────────────────────────────

// Auth
export const login = (email: string, password: string) =>
  request<{ data: unknown; token: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
  });

export const register = (data: {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
}) => request<{ data: unknown }>("/auth/register", { method: "POST", body: data });

export const forgotPassword = (email: string) =>
  request<{ message: string }>("/auth/forgot-password", { method: "POST", body: { email } });

export const resetPassword = (token: string, password: string) =>
  request<{ message: string }>("/auth/reset-password", {
    method: "PUT",
    body: { token, password },
  });

export const getMe = () =>
  request<ApiResponse<unknown>>("/auth/me");

// Workers
export const getWorkers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/workers${qs}`);
};

export const getMyWorkers = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/workers/mine${qs}`);
};

export const getWorker = (id: string) =>
  request<ApiResponse<Worker>>(`/workers/${id}`);

export const createWorker = (data: FormData) =>
  request<ApiResponse<Worker>>("/workers", {
    method: "POST",
    rawBody: data,
  });

export const updateWorker = (id: string, data: FormData) =>
  request<ApiResponse<Worker>>(`/workers/${id}`, {
    method: "POST",
    rawBody: data,
    headers: { "X-HTTP-Method": "PUT" },
  });

export const deleteWorker = (id: string) =>
  request<void>(`/workers/${id}`, { method: "DELETE" });

export const toggleWorker = (id: string) =>
  request<ApiResponse<Worker>>(`/workers/${id}/toggle`, { method: "PATCH" });

// Bookmarks
export const toggleBookmark = (workerId: string) =>
  request<ApiResponse<{ bookmarked: boolean }>>(`/workers/${workerId}/bookmark`, { method: "POST" });

export const getMyBookmarks = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Worker[]> & { meta: Meta }>(`/users/me/bookmarks${qs}`);
};

// Reviews
export const getWorkerReviews = (workerId: string, params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<ApiResponse<Review[]> & { meta: Meta; averageRating: number | null; reviewCount: number; distribution: RatingDistributionEntry[] }>(
    `/workers/${workerId}/reviews${qs}`
  );
};

export const createReview = (workerId: string, data: { rating: number; comment?: string }) =>
  request<ApiResponse<Review>>(`/workers/${workerId}/reviews`, { method: "POST", body: data });

// Contact requests
export const sendContactRequest = (workerId: string, message: string) =>
  request<ApiResponse<unknown>>(`/workers/${workerId}/contact`, { method: "POST", body: { message } });

// Categories
export const getCategories = () =>
  request<ApiResponse<Category[]>>("/categories");

// User profile
export const updateProfile = (data: { firstName?: string; lastName?: string; phone?: string; bio?: string }) =>
  request<ApiResponse<unknown>>("/users/me", { method: "PATCH", body: data });

export const changePassword = (currentPassword: string, newPassword: string) =>
  request<{ status: string; message: string }>("/users/me/password", {
    method: "PUT",
    body: { currentPassword, newPassword },
  });

export const deleteAccount = () =>
  request<{ status: string; message: string }>("/users/me", { method: "DELETE" });

// Analytics
export const getWorkerAnalytics = (workerId: string) =>
  request<ApiResponse<WorkerAnalytics>>(`/workers/${workerId}/analytics`);

export const getWorkerViewTrends = (workerId: string, days = 30) =>
  request<ApiResponse<ViewTrend[]>>(`/workers/${workerId}/analytics/trends?days=${days}`);

export const getWorkerPersonalDashboard = (workerId: string, params?: { startDate?: string; endDate?: string; days?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<WorkerPersonalDashboard>>(`/workers/${workerId}/analytics/dashboard${qs}`);
};

export const exportWorkerPersonalAnalyticsCsv = (workerId: string, params?: { startDate?: string; endDate?: string; days?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return `${BASE}/workers/${workerId}/analytics/export${qs}`;
};

export const getCuratorAnalytics = () =>
  request<ApiResponse<CuratorAnalytics>>("/analytics/curator");

export const getPlatformAnalytics = () =>
  request<ApiResponse<PlatformAnalytics>>("/analytics/platform");

export const getTopWorkers = (metric = "views", limit = 10) =>
  request<ApiResponse<TopWorker[]>>(`/analytics/top-workers?metric=${metric}&limit=${limit}`);

export const exportCuratorAnalyticsCsv = () =>
  `${BASE}/analytics/export/curator`;

export const exportPlatformAnalyticsCsv = () =>
  `${BASE}/analytics/export/platform`;

// ─── Jobs ─────────────────────────────────────────────────────────────────────

import type { Job, JobApplication, JobMessage, PaginatedResponse } from "@/types";

export interface ListJobsParams {
  categoryId?: string;
  status?: string;
  search?: string;
  skills?: string;
  urgency?: string;
  minBudget?: number;
  maxBudget?: number;
  page?: number;
  limit?: number;
}

export const getJobs = (params?: ListJobsParams) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<PaginatedResponse<Job>>(`/v1/jobs${qs}`);
};

export const getJob = (id: string) =>
  request<{ data: Job; status: string }>(`/v1/jobs/${id}`);

export const createJob = (data: {
  title: string;
  description: string;
  budget?: number;
  skills?: string[];
  urgency?: string;
  categoryId: string;
  locationId?: string;
  expiresAt?: string;
  escrowAmount?: number;
}) => request<{ data: Job }>("/v1/jobs", { method: "POST", body: data });

export const updateJob = (id: string, data: Partial<Parameters<typeof createJob>[0] & { status?: string }>) =>
  request<{ data: Job }>(`/v1/jobs/${id}`, { method: "PUT", body: data });

export const deleteJob = (id: string) =>
  request<void>(`/v1/jobs/${id}`, { method: "DELETE" });

export const renewJob = (id: string, days = 30) =>
  request<{ data: Job }>(`/v1/jobs/${id}/renew`, { method: "POST", body: { days } });

export const getMyPostedJobs = (params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<PaginatedResponse<Job>>(`/v1/jobs/me/posted${qs}`);
};

export const getMyApplications = (workerId: string, params?: { page?: number; limit?: number }) => {
  const qs = new URLSearchParams({ workerId, ...(params?.page ? { page: String(params.page) } : {}), ...(params?.limit ? { limit: String(params.limit) } : {}) }).toString();
  return request<PaginatedResponse<JobApplication>>(`/v1/jobs/me/applications?${qs}`);
};

export const getRecommendedJobs = (workerId: string) =>
  request<{ data: Job[] }>(`/v1/jobs/recommendations/${workerId}`);

export const applyToJob = (jobId: string, data: { workerId: string; coverLetter?: string; proposedRate?: number }) =>
  request<{ data: JobApplication }>(`/v1/jobs/${jobId}/apply`, { method: "POST", body: data });

export const withdrawJobApplication = (jobId: string, workerId: string) =>
  request<{ data: JobApplication }>(`/v1/jobs/${jobId}/apply`, { method: "DELETE", body: { workerId } });

export const getJobApplications = (jobId: string) =>
  request<{ data: JobApplication[] }>(`/v1/jobs/${jobId}/applications`);

export const updateJobApplicationStatus = (jobId: string, applicationId: string, status: "accepted" | "rejected") =>
  request<{ data: JobApplication }>(`/v1/jobs/${jobId}/applications/${applicationId}`, { method: "PATCH", body: { status } });

export const sendJobMessage = (jobId: string, data: { recipientId: string; body: string }) =>
  request<{ data: JobMessage }>(`/v1/jobs/${jobId}/messages`, { method: "POST", body: data });

export const getJobMessages = (jobId: string) =>
  request<{ data: JobMessage[] }>(`/v1/jobs/${jobId}/messages`);

// ── Notifications ───────────────────────────────────────────────────────────

export const getNotifications = (params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<AppNotification[]> & { meta: Meta }>(`/v1/notifications${qs}`);
};

export const getUnreadNotificationCount = () =>
  request<{ data: { count: number }; status: string; code: number }>("/v1/notifications/unread-count");

export const markNotificationRead = (id: string) =>
  request<ApiResponse<AppNotification>>(`/v1/notifications/${id}/read`, { method: "PATCH" });

export const markAllNotificationsRead = () =>
  request<{ data: { count: number }; status: string; code: number }>("/v1/notifications/read-all", { method: "PATCH" });

export const deleteNotification = (id: string) =>
  request<void>(`/v1/notifications/${id}`, { method: "DELETE" });

// ── Conversations ───────────────────────────────────────────────────────────

import type { Conversation, Message } from "@/types";

export const getConversations = (params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<Conversation[]> & { meta: Meta }>(`/v1/conversations${qs}`);
};

export const startConversation = (data: { participantId: string; subject?: string; initialMessage: string }) =>
  request<ApiResponse<Conversation>>("/v1/conversations", { method: "POST", body: data });

export const getConversation = (id: string) =>
  request<ApiResponse<Conversation>>(`/v1/conversations/${id}`);

export const getConversationMessages = (id: string, params?: { page?: number; limit?: number }) => {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()}` : "";
  return request<ApiResponse<Message[]> & { meta: Meta }>(`/v1/conversations/${id}/messages${qs}`);
};

export const sendMessage = (conversationId: string, data: { body: string; attachmentUrl?: string; attachmentType?: string }) =>
  request<ApiResponse<Message>>(`/v1/conversations/${conversationId}/messages`, { method: "POST", body: data });

export const markConversationRead = (id: string) =>
  request<{ status: string; code: number }>(`/v1/conversations/${id}/read`, { method: "PATCH" });

// ── Review Helpful ──────────────────────────────────────────────────────────

export const toggleReviewHelpful = (reviewId: string) =>
  request<{ data: { helpful: boolean; count: number }; status: string; code: number }>(`/v1/reviews/${reviewId}/helpful`, { method: "POST" });

// ── Admin ──────────────────────────────────────────────────────────────────

export const suspendUser = (userId: string) =>
  request<ApiResponse<{ id: string; suspended: boolean }>>(`/v1/admin/users/${userId}/suspend`, { method: "PATCH" });

export const unsuspendUser = (userId: string) =>
  request<ApiResponse<{ id: string; suspended: boolean }>>(`/v1/admin/users/${userId}/unsuspend`, { method: "PATCH" });

export const banUser = (userId: string) =>
  request<ApiResponse<{ id: string; banned: boolean }>>(`/v1/admin/users/${userId}/ban`, { method: "PATCH" });

export const getAuditLogs = (params?: Record<string, string>) => {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  return request<{ data: AuditLogEntry[]; meta: Meta; status: string; code: number }>(`/v1/audit${qs}`);
};
