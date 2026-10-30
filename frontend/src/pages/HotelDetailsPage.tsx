import { Link, useParams } from "react-router-dom";

function HotelDetailsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();

  return (
    <main className="account-page">
      <section className="account-page-heading">
        <p className="eyebrow">EXPLORE LITTLESPACE</p>
        <h1>Hotel Details</h1>
        <p>Discover more about your selected stay.</p>
      </section>

      <section className="empty-state">
        <h2>{hotelId?.replaceAll("-", " ")}</h2>
        <p>
          Hotel information, room types, facilities, pricing and availability
          will be displayed here.
        </p>

        <Link className="primary-button" to="/hotels">
          Back to hotels
        </Link>
      </section>
    </main>
  );
}

export default HotelDetailsPage;
