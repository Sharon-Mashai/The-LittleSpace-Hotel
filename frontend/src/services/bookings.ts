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

export type CustomerBooking = {
  id: number;
  booking_reference: string;
  check_in: string;
  check_out: string;
  nights: number;
  adults: number;
  children: number;
  booking_status: string;
  total_amount: string;
  currency: string;
  created_at: string;
  guest_full_name: string;
  guest_email: string;
  guest_phone: string;
  branch_name: string;
  room_type_name: string;
  nightly_price: string;
  payment_status: string;
};

type CreateBookingResponse = {
  success: boolean;
  message: string;
  data: CreatedBooking;
};

type GetBookingsResponse = {
  success: boolean;
  message: string;
  data: CustomerBooking[];
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

export async function getMyBookings(
  guestEmail?: string,
): Promise<CustomerBooking[]> {
  const token = getAuthToken();

  const endpoint = token
    ? "/bookings"
    : `/bookings?guestEmail=${encodeURIComponent(guestEmail ?? "")}`;

  const response = await apiRequest<GetBookingsResponse>(endpoint, {
    method: "GET",
    token: token ?? undefined,
  });

  return response.data;
}
