"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ListingForm } from "@/components/Curator/ListingForm";
import { getWorker } from "@/lib/api";
import type { Worker } from "@/types";

export default function EditListingPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { token } = useAuth();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getWorker(params.id)
      .then((r) => setWorker(r.data))
      .catch(() => setError("Failed to load listing"))
      .finally(() => setLoading(false));
  }, [params.id]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <Link
        href="/curator"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-brand-600 transition-colors"
      >
        <ArrowLeft size={15} />
        Back to console
      </Link>

      <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-8 shadow-sm">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-gray-100">
          Edit Listing
        </h1>

        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-gray-400" />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}

        {!loading && !error && worker && token && (
          <ListingForm
            workerId={worker.id}
            token={token}
            defaultValues={{
              name: worker.name,
              bio: worker.bio ?? "",
              categoryId: worker.category.id,
              phone: worker.phone ?? "",
              email: worker.email ?? "",
              walletAddress: worker.walletAddress ?? "",
            }}
            onSuccess={() => router.push("/curator")}
          />
        )}
      </div>
    </div>
  );
}
