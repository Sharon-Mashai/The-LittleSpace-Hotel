import { Link, useSearchParams } from "react-router-dom";

function BookingConfirmationPage() {
  const [searchParams] = useSearchParams();
  const bookingReference = searchParams.get("reference");

  return (
    <main className="account-page">
      <section className="empty-state confirmation-state">
        <p className="eyebrow">LITTLESPACE HOTEL</p>
        <h1>Booking Confirmation</h1>
        <h2>Your booking has been received!</h2>

        <p>
          Thank you for choosing The LittleSpace Hotel. Your booking
          confirmation details will appear here.
        </p>

        {bookingReference && (
          <p>
            Booking reference: <strong>{bookingReference}</strong>
          </p>
        )}

        <Link className="primary-button" to="/hotels">
          Explore more stays
        </Link>
      </section>
    </main>
  );
}

export default BookingConfirmationPage;
