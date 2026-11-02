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
};

type BranchesResponse = {
  success: boolean;
  count: number;
  data: HotelBranch[];
};

export async function getHotelBranches(): Promise<HotelBranch[]> {
  const response = await apiRequest<BranchesResponse>("/branches");

  return response.data;
}
