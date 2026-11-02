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

type GuestOtpResponse = {
  success: boolean;
  message: string;
};

type VerifyGuestOtpResponse = {
  success: boolean;
  message: string;
  accessToken: string;
  expiresIn: number;
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

// Request an OTP for guest booking access.
export async function requestGuestBookingOtp(
  email: string,
): Promise<GuestOtpResponse> {
  return apiRequest<GuestOtpResponse>("/guest-booking-access/request-otp", {
    method: "POST",
    body: { email },
  });
}

// Verify the guest OTP and receive a temporary access token.
export async function verifyGuestBookingOtp(
  email: string,
  otp: string,
): Promise<VerifyGuestOtpResponse> {
  return apiRequest<VerifyGuestOtpResponse>(
    "/guest-booking-access/verify-otp",
    {
      method: "POST",
      body: { email, otp },
    },
  );
}

// Retrieve bookings for either a signed-in customer or an OTP-verified guest.
export async function getMyBookings(
  guestAccessToken?: string,
): Promise<CustomerBooking[]> {
  const customerToken = getAuthToken();

  const endpoint = customerToken
    ? "/bookings"
    : "/guest-booking-access/bookings";

  const token = customerToken ?? guestAccessToken;

  if (!token) {
    throw new Error("Please verify your email to access your bookings.");
  }

  const response = await apiRequest<GetBookingsResponse>(endpoint, {
    method: "GET",
    token,
  });

  return response.data;
}
