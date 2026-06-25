"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Shield, ShieldOff, Ban, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { suspendUser, unsuspendUser, banUser } from "@/lib/api";
import { formatDate } from "@/lib/utils";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api";
const TOKEN_KEY = "bc_token";

interface AdminUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  deletedAt?: string | null;
  verified?: boolean;
  createdAt: string;
}

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem(TOKEN_KEY) : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export default function AdminUsersPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState<{ page: number; pages: number } | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async (p: number) => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/v1/admin/users?page=${p}&limit=20`, {
        headers: authHeaders(),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      setUsers(json.data);
      setMeta(json.meta ?? null);
    } catch {
      toast("Failed to load users", "error");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user && user.role !== "admin") {
      router.push("/");
      return;
    }
    fetchUsers(page);
  }, [user, router, page, fetchUsers]);

  const handleSuspend = async (userId: string) => {
    setActionLoading(userId);
    try {
      await suspendUser(userId);
      toast("User suspended", "success");
      fetchUsers(page);
    } catch {
      toast("Failed to suspend user", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnsuspend = async (userId: string) => {
    setActionLoading(userId);
    try {
      await unsuspendUser(userId);
      toast("User unsuspended", "success");
      fetchUsers(page);
    } catch {
      toast("Failed to unsuspend user", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBan = async (userId: string) => {
    if (!confirm("Are you sure you want to permanently ban this user? This will delete their account.")) return;
    setActionLoading(userId);
    try {
      await banUser(userId);
      toast("User banned", "success");
      fetchUsers(page);
    } catch {
      toast("Failed to ban user", "error");
    } finally {
      setActionLoading(null);
    }
  };

  const isSuspended = (u: AdminUser) => u.deletedAt != null;

  if (!user || user.role !== "admin") return null;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <Link
          href="/dashboard/admin"
          className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border dark:border-gray-800">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50 text-left text-xs font-medium uppercase text-gray-500 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y dark:divide-gray-800">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                      {u.firstName} {u.lastName}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-gray-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                        u.role === "admin" ? "bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400" :
                        u.role === "curator" ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" :
                        "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                      }`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isSuspended(u) ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">
                          <ShieldOff size={12} />
                          Suspended
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                          <Shield size={12} />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400 dark:text-gray-500">
                      {formatDate(new Date(u.createdAt))}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {isSuspended(u) ? (
                          <button
                            onClick={() => handleUnsuspend(u.id)}
                            disabled={actionLoading === u.id}
                            className="rounded px-2 py-1 text-xs font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-950 disabled:opacity-50 transition-colors"
                          >
                            Unsuspend
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSuspend(u.id)}
                            disabled={actionLoading === u.id}
                            className="rounded px-2 py-1 text-xs font-medium text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-950 disabled:opacity-50 transition-colors"
                          >
                            Suspend
                          </button>
                        )}
                        <button
                          onClick={() => handleBan(u.id)}
                          disabled={actionLoading === u.id || u.role === "admin"}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950 disabled:opacity-50 transition-colors"
                        >
                          <Ban size={12} />
                          Ban
                        </button>
                      </div>
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
                  onClick={() => setPage(page - 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= meta.pages}
                  onClick={() => setPage(page + 1)}
                  className="rounded border px-3 py-1 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
