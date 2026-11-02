import { apiRequest } from "./api";
import { getAuthToken } from "./auth";

export type InitializePaymentResponse = {
  success: boolean;
  message: string;
  data: {
    paymentId: number;
    bookingId: number;
    reference: string;
    amount: number;
    currency: string;
    authorizationUrl: string;
  };
};

export type BookingSummary = {
  bookingReference: string;
  branchName: string;
  roomTypeName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  nightlyPrice: number;
  totalAmount: number;
  currency: string;
};

export type VerifyPaymentResponse = {
  success: boolean;
  message: string;
  bookingId: number;
  bookingStatus: string;
  paymentStatus: string;
  bookingSummary: BookingSummary;
};

export async function initializePaystackPayment(
  bookingId: number,
  guestEmail: string,
): Promise<InitializePaymentResponse> {
  return apiRequest<InitializePaymentResponse>("/payments/initialize", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    body: {
      bookingId,
      guestEmail,
    },
  });
}

export async function verifyPaystackPayment(
  reference: string,
  guestEmail: string,
): Promise<VerifyPaymentResponse> {
  return apiRequest<VerifyPaymentResponse>("/payments/verify", {
    method: "POST",
    token: getAuthToken() ?? undefined,
    body: {
      reference,
      guestEmail,
    },
  });
}
