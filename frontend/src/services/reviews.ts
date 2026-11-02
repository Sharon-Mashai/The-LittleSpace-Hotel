import { apiRequest } from "./api";
import { getAuthToken } from "./auth";

export type HotelReview = {
  id: number;
  branch_id: number;
  booking_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name: string;
};

export type ReviewSummary = {
  review_count: number;
  average_rating: number;
};

export type BranchReviews = {
  accommodation: {
    id: number;
    name: string;
  };
  summary: ReviewSummary;
  reviews: HotelReview[];
};

type ReviewsResponse = {
  success: boolean;
  message: string;
  data: BranchReviews;
};

type ReviewResponse = {
  success: boolean;
  message: string;
  data: HotelReview;
};

export type CreateReviewData = {
  bookingId: number;
  rating: number;
  comment: string;
};

export async function getBranchReviews(
  branchId: number,
): Promise<BranchReviews> {
  const response = await apiRequest<ReviewsResponse>(
    `/reviews/branch/${branchId}`,
  );

  return response.data;
}

export async function createReview(
  reviewData: CreateReviewData,
): Promise<HotelReview> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to submit a review.");
  }

  if (
    typeof reviewData.comment !== "string" ||
    reviewData.comment.trim().length === 0
  ) {
    throw new Error("Please write a comment before submitting your review.");
  }

  if (reviewData.comment.trim().length > 2000) {
    throw new Error("Your review comment cannot exceed 2000 characters.");
  }

  const response = await apiRequest<ReviewResponse>("/reviews", {
    method: "POST",
    token,
    body: {
      ...reviewData,
      comment: reviewData.comment.trim(),
    },
  });

  return response.data;
}

export async function updateReview(
  reviewId: number,
  updates: { rating?: number; comment?: string },
): Promise<HotelReview> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to edit a review.");
  }

  if (
    updates.comment !== undefined &&
    (updates.comment.trim().length === 0 ||
      updates.comment.trim().length > 2000)
  ) {
    throw new Error(
      "Your review comment must contain text and cannot exceed 2000 characters.",
    );
  }

  const response = await apiRequest<ReviewResponse>(`/reviews/${reviewId}`, {
    method: "PATCH",
    token,
    body: {
      ...updates,
      ...(updates.comment !== undefined
        ? { comment: updates.comment.trim() }
        : {}),
    },
  });

  return response.data;
}

export async function deleteReview(reviewId: number): Promise<void> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to delete a review.");
  }

  await apiRequest("/reviews/" + reviewId, {
    method: "DELETE",
    token,
  });
}
