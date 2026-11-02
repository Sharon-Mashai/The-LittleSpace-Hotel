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
  comment?: string;
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

  const response = await apiRequest<ReviewResponse>("/reviews", {
    method: "POST",
    token,
    body: reviewData,
  });

  return response.data;
}

export async function updateReview(
  reviewId: number,
  updates: { rating?: number; comment?: string | null },
): Promise<HotelReview> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to edit a review.");
  }

  const response = await apiRequest<ReviewResponse>(`/reviews/${reviewId}`, {
    method: "PATCH",
    token,
    body: updates,
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
