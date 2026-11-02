import { apiRequest } from "./api";
import type { RoomType } from "./roomTypes";

export type AvailabilitySearch = {
  branchId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
};

export type AvailableRoomType = RoomType & {
  available_rooms: number;
};

type AvailabilityResponse = {
  success: boolean;
  count: number;
  search: AvailabilitySearch;
  data: AvailableRoomType[];
};

export async function checkRoomAvailability(
  search: AvailabilitySearch,
): Promise<AvailableRoomType[]> {
  const query = new URLSearchParams({
    branchId: String(search.branchId),
    checkIn: search.checkIn,
    checkOut: search.checkOut,
    adults: String(search.adults),
    children: String(search.children),
  });

  const response = await apiRequest<AvailabilityResponse>(
    `/availability?${query.toString()}`,
  );

  return response.data;
}
