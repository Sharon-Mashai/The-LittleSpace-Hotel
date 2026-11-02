import { useEffect, useState } from "react";
import {
  getMyBookings,
  requestGuestBookingOtp,
  verifyGuestBookingOtp,
  type CustomerBooking,
} from "../services/bookings";
import { getAuthToken } from "../services/auth";

import capeTownImage from "../assets/search-results/cape-town.png";
import tzaneenImage from "../assets/search-results/tzaneen.png";
import johannesburgImage from "../assets/search-results/johannesburg.png";
import pretoriaImage from "../assets/search-results/pretoria.png";
import durbanImage from "../assets/search-results/durban.png";
import polokwaneImage from "../assets/search-results/polokwane.png";

const GUEST_ACCESS_TOKEN_KEY = "littlespace_guest_booking_access_token";

function formatDate(dateString: string): string {
  const [year, month, day] = dateString.split("-").map(Number);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function formatCurrency(amount: string | number, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(Number(amount));
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

// Select the correct hotel image using the branch name.
function getBranchImage(branchName: string): string {
  const branch = branchName.toLowerCase();

  if (branch.includes("cape town")) return capeTownImage;
  if (branch.includes("tzaneen")) return tzaneenImage;
  if (branch.includes("johannesburg")) return johannesburgImage;
  if (branch.includes("pretoria")) return pretoriaImage;
  if (branch.includes("durban")) return durbanImage;
  if (branch.includes("polokwane")) return polokwaneImage;

  return capeTownImage;
}

function MyBookingsPage() {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");

  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);

  const [verificationStep, setVerificationStep] = useState<
    "email" | "otp" | "bookings"
  >("email");

  const [message, setMessage] = useState("");

  // Load bookings automatically for signed-in customers.
  // OTP-verified guests can also return using their saved session token.
  useEffect(() => {
    async function loadBookings() {
      const customerToken = getAuthToken();
      const guestAccessToken = sessionStorage.getItem(GUEST_ACCESS_TOKEN_KEY);

      if (!customerToken && !guestAccessToken) {
        setIsLoading(false);
        return;
      }

      setVerificationStep("bookings");

      try {
        setIsLoading(true);
        setError("");

        const customerBookings = await getMyBookings(
          guestAccessToken ?? undefined,
        );

        setBookings(customerBookings);
        setVerificationStep("bookings");
      } catch (bookingError) {
        const errorMessage =
          bookingError instanceof Error
            ? bookingError.message
            : "Unable to load your bookings. Please try again.";

        setError(errorMessage);

        if (
          !customerToken &&
          guestAccessToken &&
          /expired|invalid/i.test(errorMessage)
        ) {
          sessionStorage.removeItem(GUEST_ACCESS_TOKEN_KEY);
          setVerificationStep("email");
        }
      } finally {
        setIsLoading(false);
      }
    }

    void loadBookings();
  }, []);

  async function handleRequestOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsRequestingOtp(true);
      setError("");
      setMessage("");

      const response = await requestGuestBookingOtp(email.trim());

      setMessage(response.message);
      setVerificationStep("otp");
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to send the verification code. Please try again.",
      );
    } finally {
      setIsRequestingOtp(false);
    }
  }

  async function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      setIsVerifyingOtp(true);
      setError("");
      setMessage("");

      const response = await verifyGuestBookingOtp(email.trim(), otp.trim());

      sessionStorage.setItem(GUEST_ACCESS_TOKEN_KEY, response.accessToken);

      const guestBookings = await getMyBookings(response.accessToken);

      setBookings(guestBookings);
      setVerificationStep("bookings");
      setOtp("");
      setMessage("");
    } catch (verificationError) {
      setError(
        verificationError instanceof Error
          ? verificationError.message
          : "Unable to verify your email. Please try again.",
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  }

  function handleChangeEmail() {
    sessionStorage.removeItem(GUEST_ACCESS_TOKEN_KEY);
    setBookings([]);
    setOtp("");
    setEmail("");
    setError("");
    setMessage("");
    setVerificationStep("email");
  }

  return (
    <main className="account-page">
      <section className="account-page-heading">
        <p className="eyebrow">YOUR LITTLESPACE ACCOUNT</p>
        <h1>My Bookings</h1>
        <p>View and manage your hotel reservations.</p>
      </section>

      {isLoading && (
        <section className="empty-state">
          <h2>Loading your bookings...</h2>
          <p>Please wait while we retrieve your reservations.</p>
        </section>
      )}

      {!isLoading && !getAuthToken() && verificationStep === "email" && (
        <section className="empty-state">
          <h2>Access your guest bookings</h2>
          <p>
            Enter the email address you used when making your reservation. We'll
            send you a six-digit verification code.
          </p>

          <form onSubmit={handleRequestOtp}>
            <label htmlFor="guest-booking-email">Email address</label>
            <input
              id="guest-booking-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your booking email"
              autoComplete="email"
              required
            />

            <button type="submit" disabled={isRequestingOtp}>
              {isRequestingOtp ? "Sending code..." : "Send verification code"}
            </button>
          </form>

          {error && <p role="alert">{error}</p>}
        </section>
      )}

      {!isLoading && !getAuthToken() && verificationStep === "otp" && (
        <section className="empty-state">
          <h2>Verify your email address</h2>
          <p>
            Enter the six-digit code we sent to <strong>{email}</strong>. The
            code expires after five minutes.
          </p>

          <form onSubmit={handleVerifyOtp}>
            <label htmlFor="guest-booking-otp">Verification code</label>
            <input
              id="guest-booking-otp"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={otp}
              onChange={(event) =>
                setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="Enter six-digit code"
              autoComplete="one-time-code"
              required
            />

            <button type="submit" disabled={isVerifyingOtp}>
              {isVerifyingOtp ? "Verifying..." : "Verify and view bookings"}
            </button>
          </form>

          {message && <p role="status">{message}</p>}
          {error && <p role="alert">{error}</p>}

          <button type="button" onClick={handleChangeEmail}>
            Use a different email address
          </button>
        </section>
      )}

      {!isLoading && error && verificationStep === "bookings" && (
        <section className="empty-state">
          <h2>Unable to load bookings</h2>
          <p>{error}</p>

          {!getAuthToken() && (
            <button type="button" onClick={handleChangeEmail}>
              Verify email again
            </button>
          )}
        </section>
      )}

      {!isLoading &&
        !error &&
        verificationStep === "bookings" &&
        bookings.length === 0 && (
          <section className="empty-state">
            <h2>Your bookings will appear here</h2>
            <p>
              Once you make a reservation, you can find your booking details and
              status here.
            </p>
          </section>
        )}

      {!isLoading &&
        !error &&
        verificationStep === "bookings" &&
        bookings.length > 0 && (
          <section className="customer-bookings">
            <p>
              You have <strong>{bookings.length}</strong>{" "}
              {bookings.length === 1 ? "booking" : "bookings"}.
            </p>

            {bookings.map((booking) => (
              <article className="booking-card" key={booking.id}>
                <div className="booking-card-image">
                  <img
                    src={getBranchImage(booking.branch_name)}
                    alt={`${booking.branch_name} hotel accommodation`}
                  />
                </div>

                <div className="booking-card-heading">
                  <div>
                    <p className="eyebrow">BOOKING REFERENCE</p>
                    <h2>{booking.booking_reference}</h2>
                  </div>

                  <span className="booking-status">
                    {formatStatus(booking.booking_status)}
                  </span>
                </div>

                <div className="booking-card-details">
                  <p>
                    Branch: <strong>{booking.branch_name}</strong>
                  </p>

                  <p>
                    Room type: <strong>{booking.room_type_name}</strong>
                  </p>

                  <p>
                    Check-in: <strong>{formatDate(booking.check_in)}</strong>
                  </p>

                  <p>
                    Check-out: <strong>{formatDate(booking.check_out)}</strong>
                  </p>

                  <p>
                    Number of nights: <strong>{booking.nights}</strong>
                  </p>

                  <p>
                    Adults: <strong>{booking.adults}</strong>
                  </p>

                  <p>
                    Children: <strong>{booking.children}</strong>
                  </p>

                  <p>
                    Nightly price:{" "}
                    <strong>
                      {formatCurrency(booking.nightly_price, booking.currency)}
                    </strong>
                  </p>

                  <p>
                    Total amount:{" "}
                    <strong>
                      {formatCurrency(booking.total_amount, booking.currency)}
                    </strong>
                  </p>

                  <p>
                    Payment status:{" "}
                    <strong>{formatStatus(booking.payment_status)}</strong>
                  </p>
                </div>
              </article>
            ))}

            {!getAuthToken() && (
              <button type="button" onClick={handleChangeEmail}>
                Sign out of guest bookings
              </button>
            )}
          </section>
        )}
    </main>
  );
}

export default MyBookingsPage;
