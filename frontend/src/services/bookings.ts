
import { apiRequest } from "./api";

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
  const response = await apiRequest<CreateBookingResponse>("/bookings", {
    method: "POST",
    body: details,
  });

  return response.data;
}
