import { apiRequest } from "./api";
import { getAuthToken } from "./auth";

export type BookingHistoryRoom = {
  roomId: number;
  roomNumber: string;
  roomTypeId: number;
  roomTypeName: string;
  nightlyPrice: number | string;
  branchId: number;
  branchName: string;
  branchCity: string;
};

export type GuestBookingHistory = {
  booking_id: number;
  booking_reference: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  special_requests: string | null;
  total_amount: number | string;
  currency: string;
  created_at: string;
  rooms: BookingHistoryRoom[];
};

type BookingHistoryResponse = {
  success: boolean;
  count: number;
  data: GuestBookingHistory[];
};

export async function getBookingHistory(): Promise<GuestBookingHistory[]> {
  const token = getAuthToken();

  if (!token) {
    throw new Error("Please sign in to view your booking history.");
  }

  const response = await apiRequest<BookingHistoryResponse>(
    "/bookings/history",
    { token },
  );

  return response.data;
}
