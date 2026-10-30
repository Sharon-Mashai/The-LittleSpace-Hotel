import { Link, useSearchParams } from "react-router-dom";

function PaymentConfirmationPage() {
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference");

  return (
    <main className="account-page">
      <section className="empty-state confirmation-state">
        <p className="eyebrow">LITTLESPACE HOTEL</p>
        <h1>Payment Confirmation</h1>
        <h2>Payment status</h2>

        <p>Your payment verification result will be displayed here.</p>

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
      </section>
    </main>
  );
}

export default PaymentConfirmationPage;
