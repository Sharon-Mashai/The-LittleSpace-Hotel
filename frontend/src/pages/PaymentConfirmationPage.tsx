import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { verifyPaystackPayment } from "../services/payments";

type VerificationResult = {
  bookingId: number;
  bookingStatus: string;
  paymentStatus: string;
};

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
          response.bookingStatus === "confirmed" &&
          response.paymentStatus === "succeeded"
        ) {
          setResult({
            bookingId: response.bookingId,
            bookingStatus: response.bookingStatus,
            paymentStatus: response.paymentStatus,
          });

          sessionStorage.removeItem("littlespace_guest_email");
        } else {
          setError(response.message || "Your payment could not be confirmed.");
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

        {!isVerifying && result && (
          <>
            <h2>Payment successful!</h2>

            <p>Your payment has been verified and your booking is confirmed.</p>

            <p>
              Booking ID: <strong>{result.bookingId}</strong>
            </p>

            <p>
              Payment reference: <strong>{reference}</strong>
            </p>

            <p>
              Booking status: <strong>{result.bookingStatus}</strong>
            </p>

            <p>
              Payment status: <strong>{result.paymentStatus}</strong>
            </p>

            <Link className="primary-button" to="/my-bookings">
              View My Bookings
            </Link>
          </>
        )}

        {!isVerifying && error && (
          <>
            <h2>Payment confirmation unsuccessful</h2>

            <p>{error}</p>

            {reference && (
              <p>
                Payment reference: <strong>{reference}</strong>
              </p>
            )}

            <p>
              Your booking will only be confirmed after the backend successfully
              verifies your Paystack payment.
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
