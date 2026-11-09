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
    <main className="payment-confirmation-page">
      <section className="payment-confirmation-card">
        <div className="payment-confirmation-brand">
          <span>LITTLESPACE HOTEL</span>
          <span className="payment-confirmation-brand-line" />
        </div>

        <div className="payment-confirmation-content">
          {isVerifying && (
            <div className="payment-verification-state">
              <div className="payment-loading-indicator" />

              <span className="payment-confirmation-eyebrow">
                PAYMENT PROCESSING
              </span>

              <h1>Verifying your payment</h1>

              <p>
                Please wait while we confirm your payment securely with
                Paystack. Do not close this page.
              </p>
            </div>
          )}

          {!isVerifying && result && booking && (
            <div className="payment-success-state">
              <div className="payment-success-icon">
                <span aria-hidden="true">✓</span>
              </div>

              <span className="payment-confirmation-eyebrow">
                PAYMENT COMPLETED
              </span>

              <h1>Payment successful!</h1>

              <p className="payment-success-description">
                Your payment has been successfully verified by Paystack. Thank
                you for choosing LittleSpace Hotel.
              </p>

              {result.bookingStatus === "pending" && (
                <div className="booking-pending-notice">
                  <span className="booking-notice-icon">i</span>

                  <div>
                    <strong>Booking awaiting confirmation</strong>

                    <p>
                      Your booking has been received and is awaiting
                      confirmation from the LittleSpace Hotel administration
                      team. Your booking is not yet confirmed.
                    </p>
                  </div>
                </div>
              )}

              {result.bookingStatus === "confirmed" && (
                <div className="booking-confirmed-notice">
                  <span className="booking-notice-icon">✓</span>

                  <div>
                    <strong>Your booking is confirmed!</strong>

                    <p>
                      Your booking has been confirmed by the LittleSpace Hotel
                      administration team.
                    </p>
                  </div>
                </div>
              )}

              <div className="booking-confirmation-summary">
                <div className="booking-summary-heading">
                  <div>
                    <span>YOUR RESERVATION</span>
                    <h2>Booking Summary</h2>
                  </div>

                  <span className="booking-summary-reference">
                    #{result.bookingId}
                  </span>
                </div>

                <div className="booking-summary-reference-row">
                  <span>Booking reference</span>
                  <strong>{booking.bookingReference}</strong>
                </div>

                <div className="booking-summary-details">
                  <div className="booking-summary-detail">
                    <span>Hotel branch</span>
                    <strong>{booking.branchName}</strong>
                  </div>

                  <div className="booking-summary-detail">
                    <span>Room type</span>
                    <strong>{booking.roomTypeName}</strong>
                  </div>

                  <div className="booking-summary-detail">
                    <span>Check-in</span>
                    <strong>{formatDate(booking.checkIn)}</strong>
                  </div>

                  <div className="booking-summary-detail">
                    <span>Check-out</span>
                    <strong>{formatDate(booking.checkOut)}</strong>
                  </div>

                  <div className="booking-summary-detail">
                    <span>Number of nights</span>
                    <strong>{booking.nights}</strong>
                  </div>

                  <div className="booking-summary-detail">
                    <span>Nightly price</span>
                    <strong>
                      {formatCurrency(booking.nightlyPrice, booking.currency)}
                    </strong>
                  </div>
                </div>

                <div className="booking-summary-total">
                  <div>
                    <span>Total amount paid</span>
                    <strong>
                      {formatCurrency(booking.totalAmount, booking.currency)}
                    </strong>
                  </div>

                  <span>{booking.currency}</span>
                </div>

                <div className="booking-summary-statuses">
                  <div className="booking-summary-status-row">
                    <span>Booking status</span>

                    <strong
                      className={`booking-status-label booking-status-${result.bookingStatus.toLowerCase()}`}
                    >
                      {result.bookingStatus.replace(/_/g, " ")}
                    </strong>
                  </div>

                  <div className="booking-summary-status-row">
                    <span>Payment status</span>

                    <strong className="payment-status-label">
                      {result.paymentStatus.replace(/_/g, " ")}
                    </strong>
                  </div>
                </div>

                <div className="booking-summary-payment-reference">
                  <span>Paystack reference</span>
                  <strong>{reference}</strong>
                </div>
              </div>

              <Link
                className="primary-button payment-confirmation-button"
                to="/my-bookings"
              >
                View My Bookings
                <span aria-hidden="true">→</span>
              </Link>

              <p className="payment-confirmation-footer">
                Thank you for booking with LittleSpace Hotel.
              </p>
            </div>
          )}

          {!isVerifying && error && (
            <div className="payment-error-state">
              <div className="payment-error-icon">
                <span aria-hidden="true">!</span>
              </div>

              <span className="payment-confirmation-eyebrow">
                PAYMENT VERIFICATION
              </span>

              <h1>We couldn't verify your payment</h1>

              <p>{error}</p>

              {reference && (
                <div className="payment-error-reference">
                  <span>Payment reference</span>
                  <strong>{reference}</strong>
                </div>
              )}

              <p className="payment-error-note">
                Your booking will only proceed to hotel confirmation after the
                backend successfully verifies your Paystack payment. If you have
                been charged, please contact LittleSpace support before
                attempting another payment.
              </p>

              <Link
                className="primary-button payment-confirmation-button"
                to="/my-bookings"
              >
                View My Bookings
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

export default PaymentConfirmationPage;
