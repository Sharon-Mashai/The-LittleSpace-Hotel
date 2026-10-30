function MyBookingsPage() {
  return (
    <main className="account-page">
      <section className="account-page-heading">
        <p className="eyebrow">YOUR LITTLESPACE ACCOUNT</p>
        <h1>My Bookings</h1>
        <p>View and manage your hotel reservations.</p>
      </section>

      <section className="empty-state">
        <h2>Your bookings will appear here</h2>
        <p>
          Once you make a reservation, you can find your booking details and
          status here.
        </p>
      </section>
    </main>
  );
}

export default MyBookingsPage;
