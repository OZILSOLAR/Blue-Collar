"use client";

import { useState, useMemo } from "react";
import ReviewCard from "./ReviewCard";
import ReviewForm from "./ReviewForm";
import RatingBreakdown from "./RatingBreakdown";
import ReviewSortFilter, { type SortOption } from "./ReviewSortFilter";
import EmptyState from "./EmptyState";
import type { Review, RatingDistributionEntry } from "@/types";
import { getWorkerReviews } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const PAGE_SIZE = 5;

interface Props {
  workerId: string;
  initialReviews: Review[];
  reviewCount: number;
  averageRating: number | null;
  distribution: RatingDistributionEntry[];
}

export default function ReviewsSection({
  workerId,
  initialReviews,
  reviewCount,
  averageRating,
  distribution,
}: Props) {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [count, setCount] = useState<number>(reviewCount);
  const [filteredReviews, setFilteredReviews] = useState<Review[] | null>(null);
  const [filterLoading, setFilterLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [sort, setSort] = useState<SortOption>("newest");

  const hasReviewed = !!user && reviews.some((r) => r.authorId === user.id);

  const handleReviewCreated = (review: Review) => {
    setReviews((prev) => [review, ...prev]);
    setCount((c) => c + 1);
    setVisibleCount((v) => v + 1);
  };

  const handleFilterChange = async (rating: number | null) => {
    if (rating === null) {
      setFilteredReviews(null);
      setVisibleCount(PAGE_SIZE);
      return;
    }
    setFilterLoading(true);
    try {
      const res = await getWorkerReviews(workerId, { rating: String(rating), limit: "50" });
      setFilteredReviews(res.data);
      setVisibleCount(PAGE_SIZE);
    } catch {
      setFilteredReviews(null);
    } finally {
      setFilterLoading(false);
    }
  };

  const source = filteredReviews ?? reviews;

  const sorted = useMemo(() => {
    const sortedArr = [...source];
    switch (sort) {
      case "newest":
        return sortedArr.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case "oldest":
        return sortedArr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      case "highest":
        return sortedArr.sort((a, b) => b.rating - a.rating);
      case "lowest":
        return sortedArr.sort((a, b) => a.rating - b.rating);
      default:
        return sortedArr;
    }
  }, [source, sort]);

  const displayed = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;

  return (
    <div className="mt-8 border-t pt-6 dark:border-gray-800">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
          Reviews {count > 0 && `(${count})`}
        </h2>
        {count > 0 && <ReviewSortFilter sort={sort} onSortChange={setSort} />}
      </div>

      {count > 0 && (
        <RatingBreakdown
          averageRating={averageRating}
          reviewCount={count}
          distribution={distribution}
          onFilterChange={handleFilterChange}
        />
      )}

      <div className="mb-6">
        {hasReviewed ? (
          <p className="text-sm text-gray-500 italic dark:text-gray-400">You have already reviewed this worker.</p>
        ) : (
          <>
            <p className="text-sm font-medium text-gray-700 mb-3 dark:text-gray-300">Leave a review</p>
            <ReviewForm workerId={workerId} onReviewCreated={handleReviewCreated} />
          </>
        )}
      </div>

      {filterLoading ? (
        <div className="py-6 text-center text-sm text-gray-400">Loading...</div>
      ) : displayed.length > 0 ? (
        <div>
          {displayed.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
          {hasMore && (
            <button
              onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              className="mt-4 w-full rounded-lg border py-2 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800 transition-colors"
            >
              Load more ({sorted.length - visibleCount} remaining)
            </button>
          )}
        </div>
      ) : (
        <EmptyState variant="no-reviews" ctaHref="#review-form" />
      )}
    </div>
  );
}
