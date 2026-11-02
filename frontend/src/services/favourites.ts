import { apiRequest } from "./api";
import { getAuthToken } from "./auth";

export type GuestFavourite = {
  branch_id: number;
  favourited_at: string;
  name: string;
  slug: string;
  description: string | null;
  address_line: string;
  suburb: string | null;
  city: string;
  province: string | null;
  star_rating: number | null;
  is_active: boolean;
};

type FavouritesResponse = {
  success: boolean;
  message: string;
  data: GuestFavourite[];
};

type FavouriteActionResponse = {
  success: boolean;
  message: string;
  data: {
    branchId: string;
  };
};

function requireToken(): string {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to manage your favourites.");
  }

  return token;
}

export async function getGuestFavourites(): Promise<GuestFavourite[]> {
  const response = await apiRequest<FavouritesResponse>("/favourites", {
    token: requireToken(),
  });

  return response.data;
}

export async function addGuestFavourite(
  branchId: number,
): Promise<FavouriteActionResponse> {
  return apiRequest<FavouriteActionResponse>(`/favourites/${branchId}`, {
    method: "POST",
    token: requireToken(),
  });
}

export async function removeGuestFavourite(
  branchId: number,
): Promise<FavouriteActionResponse> {
  return apiRequest<FavouriteActionResponse>(`/favourites/${branchId}`, {
    method: "DELETE",
    token: requireToken(),
  });
}
