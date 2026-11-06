import { apiRequest } from "./api";

export type HotelBranch = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address_line: string;
  suburb: string | null;
  city: string;
  province: string | null;
  country: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  star_rating: number | null;
  review_count: number;
  average_rating: number;
  latest_review_rating: number | null;
  latest_review_comment: string | null;
  latest_review_author: string | null;
};

type BranchesResponse = {
  success: boolean;
  count: number;
  data: HotelBranch[];
};

export async function getHotelBranches(): Promise<HotelBranch[]> {
  const response = await apiRequest<BranchesResponse>("/branches");

  return response.data.map((branch) => {
    const latitude = branch.latitude === null ? null : Number(branch.latitude);

    const longitude =
      branch.longitude === null ? null : Number(branch.longitude);

    const starRating =
      branch.star_rating === null ? null : Number(branch.star_rating);

    return {
      ...branch,
      review_count: Number(branch.review_count),
      average_rating: Number(branch.average_rating),
      star_rating:
        starRating !== null && Number.isFinite(starRating) ? starRating : null,
      latest_review_rating:
        branch.latest_review_rating === null
          ? null
          : Number(branch.latest_review_rating),
      latitude:
        latitude !== null && Number.isFinite(latitude) ? latitude : null,
      longitude:
        longitude !== null && Number.isFinite(longitude) ? longitude : null,
    };
  });
}
