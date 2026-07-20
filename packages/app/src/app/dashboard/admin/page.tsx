"use client";

import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import {
  Users,
  Briefcase,
  Eye,
  MessageSquare,
  Star,
  TrendingUp,
  TrendingDown,
  Download,
  DollarSign,
  Shield,
  Scale,
  ClipboardList,
  Search,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { formatDate } from "@/lib/utils";
import { AdminDashboardSkeleton } from "@/components/Skeleton";
import type { PlatformAnalytics, Category } from "@/types";
import Link from "next/link";

// ── Dynamic imports (code splitting: recharts is ~200KB) ─────────────────────
const AdminCharts = dynamic(
  () => import("@/components/charts/AdminCharts"),
  { ssr: false, loading: () => <div className="h-[300px] rounded-lg bg-gray-50 animate-pulse" /> }
);

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const TOKEN_KEY = "bc_token";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  createdAt: string;
  verified?: boolean;
}

type Tab = "overview" | "users" | "categories" | "moderation";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [data, setData] = useState<PlatformAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("overview");

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersMeta, setUsersMeta] = useState<{ page: number; pages: number } | null>(null);
  const [usersPage, setUsersPage] = useState(1);

  const [categories, setCategories] = useState<Category[]>([]);
  const [catsLoading, setCatsLoading] = useState(false);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
      return;
    }

    const fetchAnalytics = async () => {
      try {
        const res = await fetch(`${API}/analytics/platform`, {
          headers: authHeaders(),
        });
        if (!res.ok) throw new Error("Failed to fetch analytics");
        const json = await res.json();
        setData(json.data);
      } catch {
        toast("Failed to load dashboard analytics", "error");
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
  }, [user, router, toast]);

  const fetchUsers = useCallback(async (page: number) => {
    setUsersLoading(true);
    try {
      const res = await fetch(`${API}/admin/users?page=${page}&limit=20`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setUsers(json.data);
      setUsersMeta(json.meta ?? null);
    } catch {
      toast("Failed to load users", "error");
    } finally {
      setUsersLoading(false);
    }
  }, [toast]);

  const fetchCategories = useCallback(async () => {
    setCatsLoading(true);
    try {
      const res = await fetch(`${API}/categories`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setCategories(json.data);
    } catch {
      toast("Failed to load categories", "error");
    } finally {
      setCatsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (tab === "users" && users.length === 0) fetchUsers(1);
    if (tab === "categories" && categories.length === 0) fetchCategories();
  }, [tab, users.length, categories.length, fetchUsers, fetchCategories]);

  const handleExportCsv = () => {
    const link = document.createElement("a");
    link.href = `${API}/analytics/export/platform`;
    link.setAttribute("download", "platform-analytics.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!user || user.role !== "admin") return null;
  if (isLoading) return <AdminDashboardSkeleton />;
  if (!data) return <div className="p-8 text-center text-gray-500">Failed to load analytics</div>;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <button
          onClick={handleExportCsv}
          className="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Quick Links */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Link href="/dashboard/admin/users" className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">User Management</p>
            <p className="text-xs text-gray-500">Ban, suspend, manage</p>
          </div>
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </Link>
        <Link href="/dashboard/admin/disputes" className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-50 text-yellow-600 dark:bg-yellow-950 dark:text-yellow-400">
            <Scale size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Dispute Review</p>
            <p className="text-xs text-gray-500">Resolve disputes</p>
          </div>
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </Link>
        <Link href="/dashboard/admin/audit" className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400">
            <ClipboardList size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Audit Log</p>
            <p className="text-xs text-gray-500">View activity</p>
          </div>
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </Link>
        <button onClick={() => setTab("moderation")} className="flex items-center gap-3 rounded-lg border bg-white p-4 hover:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:hover:bg-gray-800 transition-colors text-left">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600 dark:bg-green-950 dark:text-green-400">
            <Search size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Moderation</p>
            <p className="text-xs text-gray-500">Review queue</p>
          </div>
          <ExternalLink size={14} className="ml-auto text-gray-400" />
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-8 flex gap-1 border-b">
        {(["overview", "users", "categories", "moderation"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab data={data} />}

      {tab === "users" && (
        <UsersTab
          users={users}
          loading={usersLoading}
          meta={usersMeta}
          page={usersPage}
          onPageChange={(p) => {
            setUsersPage(p);
            fetchUsers(p);
          }}
        />
      )}

      {tab === "categories" && (
        <CategoriesTab categories={categories} loading={catsLoading} />
      )}

      {tab === "moderation" && <ModerationTab />}
    </div>
  );
}

function OverviewTab({ data }: { data: PlatformAnalytics }) {
  return (
    <>
      {/* Overview Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={<Briefcase size={20} />}
          label="Total Workers"
          value={data.overview.totalWorkers}
          sub={`${data.overview.activeWorkers} active`}
        />
        <StatCard
          icon={<Users size={20} />}
          label="Total Users"
          value={data.overview.totalUsers}
          sub={`${data.overview.totalCurators} curators`}
        />
        <StatCard
          icon={<Eye size={20} />}
          label="Profile Views"
          value={data.engagement.totalViews}
          sub={`${data.engagement.viewsThisMonth.toLocaleString()} this month`}
        />
        <StatCard
          icon={<DollarSign size={20} />}
          label="Total Tips"
          value={`${data.revenue.totalTips.toLocaleString()} XLM`}
          sub={`${data.revenue.totalTipCount} transactions`}
        />
      </div>

      {/* Growth Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        <GrowthCard
          label="Workers This Month"
          value={data.growth.workersThisMonth}
          pct={data.growth.workerGrowthPct}
        />
        <GrowthCard
          label="Users This Month"
          value={data.growth.usersThisMonth}
          pct={data.growth.userGrowthPct}
        />
        <StatCard
          icon={<Star size={20} />}
          label="Reviews"
          value={data.engagement.totalReviews}
          sub={`${data.engagement.reviewsThisMonth} this month`}
        />
        <StatCard
          icon={<MessageSquare size={20} />}
          label="Contact Requests"
          value={data.engagement.totalContacts}
          sub={`${data.engagement.contactsThisMonth} this month`}
        />
      </div>

      {/* Growth Trends Charts */}
      <div className="mb-8 grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">User Growth (6 months)</h2>
          <AdminCharts.UserGrowthChart data={data.trends.userGrowth} />
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Worker Growth (6 months)</h2>
          <AdminCharts.WorkerGrowthChart data={data.trends.workerGrowth} />
        </div>
      </div>

      {/* Top Categories Chart */}
      <div className="mb-8 rounded-lg border bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Top Categories</h2>
        <AdminCharts.TopCategoriesChart data={data.topCategories} />
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent Worker Registrations</h2>
          <div className="space-y-3">
            {data.recentWorkers.length > 0 ? (
              data.recentWorkers.map((worker) => (
                <div key={worker.id} className="flex items-start justify-between border-b pb-3 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">{worker.name}</p>
                    <p className="text-sm text-gray-500">{worker.category.name}</p>
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(new Date(worker.createdAt))}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No recent registrations</p>
            )}
          </div>
        </div>

        <div className="rounded-lg border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Recent User Signups</h2>
          <div className="space-y-3">
            {data.recentUsers.length > 0 ? (
              data.recentUsers.map((u) => (
                <div key={u.id} className="flex items-start justify-between border-b pb-3 last:border-b-0">
                  <div>
                    <p className="font-medium text-gray-900">
                      {u.firstName} {u.lastName}
                    </p>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <RoleBadge role={u.role} />
                  </div>
                  <p className="text-xs text-gray-400">{formatDate(new Date(u.createdAt))}</p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-400">No recent signups</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function UsersTab({
  users,
  loading,
  meta,
  page,
  onPageChange,
}: {
  users: AdminUser[];
  loading: boolean;
  meta: { page: number; pages: number } | null;
  page: number;
  onPageChange: (p: number) => void;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Joined</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {u.firstName} {u.lastName}
                </td>
                <td className="px-4 py-3 text-gray-500">{u.email}</td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role} />
                </td>
                <td className="px-4 py-3 text-gray-400">
                  {formatDate(new Date(u.createdAt))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && meta.pages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {meta.pages}</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={page >= meta.pages}
              onClick={() => onPageChange(page + 1)}
              className="rounded border px-3 py-1 hover:bg-gray-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoriesTab({
  categories,
  loading,
}: {
  categories: Category[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-white">
      <div className="border-b px-4 py-3">
        <h2 className="font-semibold text-gray-900">Categories ({categories.length})</h2>
      </div>
      <div className="divide-y">
        {categories.map((cat) => (
          <div key={cat.id} className="flex items-center gap-3 px-4 py-3">
            {cat.icon && <span className="text-xl">{cat.icon}</span>}
            <span className="font-medium text-gray-800">{cat.name}</span>
          </div>
        ))}
        {categories.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-gray-400">No categories found</p>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border bg-white p-6">
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        {icon}
        <p className="text-sm font-medium text-gray-600">{label}</p>
      </div>
      <p className="text-3xl font-bold text-gray-900 mt-1">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function GrowthCard({
  label,
  value,
  pct,
}: {
  label: string;
  value: number;
  pct: number;
}) {
  const isPositive = pct >= 0;
  return (
    <div className="rounded-lg border bg-white p-6">
      <p className="text-sm font-medium text-gray-600">{label}</p>
      <div className="flex items-end gap-2 mt-2">
        <p className="text-3xl font-bold text-gray-900">{value}</p>
        <span
          className={`flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-medium ${
            isPositive ? "bg-green-50 text-green-600" : "bg-red-50 text-red-600"
          }`}
        >
          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Math.abs(pct)}%
        </span>
      </div>
      <p className="text-xs text-gray-400 mt-1">vs last month</p>
    </div>
  );
}

function ModerationTab() {
  const [reviews, setReviews] = useState<Array<{
    id: string; rating: number; comment?: string | null; body?: string | null;
    flagged: boolean; flagReason?: string | null; status: string; createdAt: string;
    worker: { id: string; name: string };
    author: { id: string; firstName: string; lastName: string };
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/reviews/moderation/queue`, { headers: authHeaders() });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setReviews(json.data);
    } catch {
      toast("Failed to load moderation queue", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleModerate = async (reviewId: string, action: "approve" | "reject") => {
    setActionLoading(reviewId);
    try {
      const res = await fetch(`${API}/v1/reviews/${reviewId}/moderate`, {
        method: "PATCH",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) throw new Error();
      toast(`Review ${action}d`, "success");
      setReviews((prev) => prev.filter((r) => r.id !== reviewId));
    } catch {
      toast("Failed to moderate review", "error");
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" /></div>;
  }

  if (reviews.length === 0) {
    return <div className="flex flex-col items-center justify-center gap-3 py-20 text-gray-400">
      <Search size={40} className="opacity-30" />
      <p className="text-sm">No reviews pending moderation</p>
    </div>;
  }

  return (
    <div className="space-y-4">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-xl border bg-white p-5 dark:border-gray-800 dark:bg-gray-900">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-medium text-gray-900 dark:text-gray-100">{review.author.firstName} {review.author.lastName}</span>
                <span className="text-xs text-gray-400">reviewed</span>
                <span className="font-medium text-gray-900 dark:text-gray-100">{review.worker.name}</span>
              </div>
              <div className="flex items-center gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star key={s} size={12} className={s <= review.rating ? "text-yellow-400" : "text-gray-200"} fill={s <= review.rating ? "currentColor" : "none"} />
                ))}
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">{review.comment ?? review.body}</p>
              {review.flagged && review.flagReason && (
                <p className="mt-1 text-xs text-red-500">Flagged: {review.flagReason}</p>
              )}
              <p className="mt-1 text-xs text-gray-400">{formatDate(new Date(review.createdAt))}</p>
            </div>
            <div className="flex flex-col gap-1">
              <button
                onClick={() => handleModerate(review.id, "approve")}
                disabled={actionLoading === review.id}
                className="rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === review.id ? <Loader2 size={14} className="animate-spin" /> : "Approve"}
              </button>
              <button
                onClick={() => handleModerate(review.id, "reject")}
                disabled={actionLoading === review.id}
                className="rounded-lg bg-red-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const colors: Record<string, string> = {
    admin: "bg-red-50 text-red-600",
    curator: "bg-purple-50 text-purple-600",
    user: "bg-blue-50 text-blue-600",
  };
  return (
    <span className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${colors[role] ?? "bg-gray-100 text-gray-600"}`}>
      {role}
    </span>
  );
}
