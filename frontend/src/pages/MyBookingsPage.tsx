import { useEffect, useState } from "react";
import { getMyBookings, type CustomerBooking } from "../services/bookings";

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

function MyBookingsPage() {
  const [bookings, setBookings] = useState<CustomerBooking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadBookings() {
      try {
        setIsLoading(true);
        setError("");

        const guestEmail = sessionStorage.getItem("littlespace_guest_email");

        const customerBookings = await getMyBookings(guestEmail ?? undefined);

        setBookings(customerBookings);
      } catch (bookingError) {
        setError(
          bookingError instanceof Error
            ? bookingError.message
            : "Unable to load your bookings. Please try again.",
        );
      } finally {
        setIsLoading(false);
      }
    }

    void loadBookings();
  }, []);

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

      {!isLoading && error && (
        <section className="empty-state">
          <h2>Unable to load bookings</h2>
          <p>{error}</p>
        </section>
      )}

      {!isLoading && !error && bookings.length === 0 && (
        <section className="empty-state">
          <h2>Your bookings will appear here</h2>
          <p>
            Once you make a reservation, you can find your booking details and
            status here.
          </p>
        </section>
      )}

      {!isLoading && !error && bookings.length > 0 && (
        <section className="customer-bookings">
          <p>
            You have <strong>{bookings.length}</strong>{" "}
            {bookings.length === 1 ? "booking" : "bookings"}.
          </p>

          {bookings.map((booking) => (
            <article className="booking-card" key={booking.id}>
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
        </section>
      )}
    </main>
  );
}

export default MyBookingsPage;
