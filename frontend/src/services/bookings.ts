import { apiRequest } from "./api";
import { getAuthToken } from "./auth";

export type CreateBookingDetails = {
  branchId: number;
  roomTypeId: number;
  checkIn: string;
  checkOut: string;
  adults: number;
  children: number;
  guestFullName: string;
  guestEmail: string;
  guestPhone: string;
  specialRequests?: string;
};

export type CreatedBooking = {
  id: number;
  booking_reference: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  total_amount: string;
  currency: string;
  created_at: string;
  roomId: number;
  nights: number;
  nightlyPrice: string;
  guestEmail: string;
};

type CreateBookingResponse = {
  success: boolean;
  message: string;
  data: CreatedBooking;
};

export async function createBooking(
  details: CreateBookingDetails,
): Promise<CreatedBooking> {
  return apiRequest<CreateBookingResponse>("/bookings", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    body: details,
  }).then((response) => response.data);
}
