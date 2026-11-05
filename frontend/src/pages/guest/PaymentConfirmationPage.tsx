import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  verifyPaystackPayment,
  type BookingSummary,
} from "../../services/payments";

type VerificationResult = {
  bookingId: number;
  bookingStatus: string;
  paymentStatus: string;
  bookingSummary: BookingSummary;
};

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);

  const date = new Date(year, month - 1, day);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(amount);
}

function PaymentConfirmationPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference");

  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState("");
  const [result, setResult] = useState<VerificationResult | null>(null);

  const verificationStarted = useRef(false);

  useEffect(() => {
    if (verificationStarted.current) {
      return;
    }

    verificationStarted.current = true;

    async function verifyPayment() {
      if (!reference) {
        setError("No payment reference was received from Paystack.");
        setIsVerifying(false);
        return;
      }

      const guestEmail = sessionStorage.getItem("littlespace_guest_email");

      if (!guestEmail) {
        setError(
          "We could not find the email address used for this booking. Please contact LittleSpace support for assistance.",
        );
        setIsVerifying(false);
        return;
      }

      try {
        const response = await verifyPaystackPayment(reference, guestEmail);

        if (
          response.success &&
          response.paymentStatus === "succeeded" &&
          response.bookingSummary
        ) {
          setResult({
            bookingId: response.bookingId,
            bookingStatus: response.bookingStatus,
            paymentStatus: response.paymentStatus,
            bookingSummary: response.bookingSummary,
          });
        } else {
          setError(
            response.message ||
              "Your payment could not be verified. Please contact LittleSpace support if you have been charged.",
          );
        }
      } catch (verificationError) {
        setError(
          verificationError instanceof Error
            ? verificationError.message
            : "An error occurred while verifying your payment.",
        );
      } finally {
        setIsVerifying(false);
      }
    }

    void verifyPayment();
  }, [reference]);

  const booking = result?.bookingSummary;

  return (
    <main className="account-page">
      <section className="empty-state confirmation-state">
        <p className="eyebrow">LITTLESPACE HOTEL</p>

        <h1>Payment Confirmation</h1>

        {isVerifying && (
          <>
            <h2>Verifying your payment...</h2>

            <p>
              Please wait while we confirm your payment with Paystack. Do not
              close this page.
            </p>
          </>
        )}

        {!isVerifying && result && booking && (
          <>
            <h2>Payment successful!</h2>

            <p>Your payment has been successfully verified by Paystack.</p>

            {result.bookingStatus === "pending" && (
              <p>
                Your booking has been received and is awaiting confirmation from
                the LittleSpace Hotel administration team. Your booking is not
                yet confirmed.
              </p>
            )}

            {result.bookingStatus === "confirmed" && (
              <p>
                Your booking has also been confirmed by the LittleSpace Hotel
                administration team.
              </p>
            )}

            <div className="booking-confirmation-summary">
              <h2>Booking Summary</h2>

              <p>
                Booking reference: <strong>{booking.bookingReference}</strong>
              </p>

              <p>
                Booking ID: <strong>{result.bookingId}</strong>
              </p>

              <p>
                Branch: <strong>{booking.branchName}</strong>
              </p>

              <p>
                Room type: <strong>{booking.roomTypeName}</strong>
              </p>

              <p>
                Check-in: <strong>{formatDate(booking.checkIn)}</strong>
              </p>

              <p>
                Check-out: <strong>{formatDate(booking.checkOut)}</strong>
              </p>

              <p>
                Number of nights: <strong>{booking.nights}</strong>
              </p>

              <p>
                Nightly price:{" "}
                <strong>
                  {formatCurrency(booking.nightlyPrice, booking.currency)}
                </strong>
              </p>

              <p>
                Total amount:{" "}
                <strong>
                  {formatCurrency(booking.totalAmount, booking.currency)}
                </strong>
              </p>

              <p>
                Currency: <strong>{booking.currency}</strong>
              </p>

              <p>
                Booking status: <strong>{result.bookingStatus}</strong>
              </p>

              <p>
                Payment status: <strong>{result.paymentStatus}</strong>
              </p>

              <p>
                Paystack reference: <strong>{reference}</strong>
              </p>
            </div>

            <Link className="primary-button" to="/my-bookings">
              View My Bookings
            </Link>
          </>
        )}

        {!isVerifying && error && (
          <>
            <h2>Payment verification unsuccessful</h2>

            <p>{error}</p>

            {reference && (
              <p>
                Payment reference: <strong>{reference}</strong>
              </p>
            )}

            <p>
              Your booking will only proceed to hotel confirmation after the
              backend successfully verifies your Paystack payment.
            </p>

            <Link className="primary-button" to="/my-bookings">
              View My Bookings
            </Link>
          </>
        )}
      </section>
    </main>
  );
}

export default PaymentConfirmationPage;
