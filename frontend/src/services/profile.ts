import { apiRequest } from "./api";
import { getAuthToken } from "./auth";

export type GuestProfile = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at?: string;
};

type ProfileResponse = {
  success: boolean;
  message?: string;
  data: GuestProfile;
};

export async function getGuestProfile(): Promise<GuestProfile> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to view your profile.");
  }

  const response = await apiRequest<ProfileResponse>("/profile", {
    token,
  });

  return response.data;
}

export async function updateGuestProfile(
  fullName: string,
  phone: string,
): Promise<GuestProfile> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to update your profile.");
  }

  const response = await apiRequest<ProfileResponse>("/profile", {
    method: "PATCH",
    token,
    body: {
      fullName,
      phone: phone.trim() || null,
    },
  });

  return response.data;
}
