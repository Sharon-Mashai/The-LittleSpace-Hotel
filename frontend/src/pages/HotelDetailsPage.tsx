import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getHotelBranches, type HotelBranch } from "../services/branches";
import { getBranchRoomTypes, type RoomType } from "../services/roomTypes";
import {
  checkRoomAvailability,
  type AvailableRoomType,
} from "../services/availability";

function HotelDetailsPage() {
  const { hotelId } = useParams<{ hotelId: string }>();

  const [branch, setBranch] = useState<HotelBranch | null>(null);
  const [roomTypes, setRoomTypes] = useState<RoomType[]>([]);
  const [availableRooms, setAvailableRooms] = useState<
    AvailableRoomType[] | null
  >(null);

  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);

  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [error, setError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");

  useEffect(() => {
    async function loadBranchDetails() {
      try {
        setLoading(true);
        setError("");

        const branches = await getHotelBranches();
        const matchingBranch = branches.find((item) => item.slug === hotelId);

        if (!matchingBranch) {
          setBranch(null);
          setRoomTypes([]);
          setError("We could not find this LittleSpace branch.");
          return;
        }

        setBranch(matchingBranch);

        const rooms = await getBranchRoomTypes(matchingBranch.id);
        setRoomTypes(rooms);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load the hotel details.",
        );
      } finally {
        setLoading(false);
      }
    }

    if (hotelId) {
      loadBranchDetails();
    }
  }, [hotelId]);

  async function handleAvailabilitySearch(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (!branch) return;

    if (!checkIn || !checkOut) {
      setAvailabilityError("Please select both check-in and check-out dates.");
      return;
    }

    if (checkOut <= checkIn) {
      setAvailabilityError("Check-out must be after check-in.");
      return;
    }

    try {
      setCheckingAvailability(true);
      setAvailabilityError("");
      setAvailableRooms(null);

      const results = await checkRoomAvailability({
        branchId: branch.id,
        checkIn,
        checkOut,
        adults,
        children,
      });

      setAvailableRooms(results);
    } catch (err) {
      setAvailabilityError(
        err instanceof Error
          ? err.message
          : "Unable to check room availability.",
      );
    } finally {
      setCheckingAvailability(false);
    }
  }

  function formatPrice(price: number | string, currency: string) {
    return new Intl.NumberFormat("en-ZA", {
      style: "currency",
      currency,
    }).format(Number(price));
  }

  if (loading) {
    return (
      <main className="account-page">
        <section className="empty-state">
          <p>Loading LittleSpace branch details...</p>
        </section>
      </main>
    );
  }

  if (error || !branch) {
    return (
      <main className="account-page">
        <section className="empty-state">
          <h1>Hotel details unavailable</h1>
          <p>{error || "This branch could not be found."}</p>
          <Link className="primary-button" to="/hotels">
            Back to hotels
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <section className="account-page-heading">
        <p className="eyebrow">EXPLORE LITTLESPACE</p>
        <h1>{branch.name}</h1>
        <p>
          {branch.city}
          {branch.province ? `, ${branch.province}` : ""}
        </p>
      </section>

      <section className="empty-state">
        <h2>About this branch</h2>

        {branch.description && <p>{branch.description}</p>}

        <p>
          {branch.address_line}
          {branch.suburb ? `, ${branch.suburb}` : ""}
          {branch.city ? `, ${branch.city}` : ""}
          {branch.province ? `, ${branch.province}` : ""}
        </p>

        {branch.star_rating !== null && (
          <p>Star rating: {branch.star_rating} stars</p>
        )}

        <p>
          Guest rating: {branch.average_rating} / 5 ({branch.review_count}{" "}
          reviews)
        </p>
      </section>

      <section className="account-page-heading">
        <h2>Our room types</h2>
        <p>Explore the rooms available at this LittleSpace branch.</p>
      </section>

      {roomTypes.length === 0 ? (
        <section className="empty-state">
          <p>No active room types are currently listed for this branch.</p>
        </section>
      ) : (
        <section className="favourites-list">
          {roomTypes.map((room) => (
            <article className="favourite-card" key={room.id}>
              <div>
                <h3>{room.name}</h3>
                {room.description && <p>{room.description}</p>}

                <p>
                  Adults: {room.capacity_adults} | Children:{" "}
                  {room.capacity_children}
                </p>

                <p>
                  From {formatPrice(room.base_price, room.currency)} per night
                </p>

                {room.facilities && room.facilities.length > 0 && (
                  <p>Facilities: {room.facilities.join(", ")}</p>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      <section className="account-page-heading">
        <h2>Check room availability</h2>
        <p>Select your dates and guests to see which rooms are available.</p>
      </section>

      <section className="empty-state">
        <form onSubmit={handleAvailabilitySearch}>
          <div>
            <label htmlFor="checkIn">Check-in date</label>
            <input
              id="checkIn"
              type="date"
              value={checkIn}
              onChange={(event) => setCheckIn(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="checkOut">Check-out date</label>
            <input
              id="checkOut"
              type="date"
              value={checkOut}
              min={checkIn || undefined}
              onChange={(event) => setCheckOut(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="adults">Adults</label>
            <input
              id="adults"
              type="number"
              min="1"
              value={adults}
              onChange={(event) => setAdults(Number(event.target.value))}
              required
            />
          </div>

          <div>
            <label htmlFor="children">Children</label>
            <input
              id="children"
              type="number"
              min="0"
              value={children}
              onChange={(event) => setChildren(Number(event.target.value))}
              required
            />
          </div>

          {availabilityError && <p role="alert">{availabilityError}</p>}

          <button
            className="primary-button"
            type="submit"
            disabled={checkingAvailability}
          >
            {checkingAvailability ? "Checking..." : "Check availability"}
          </button>
        </form>
      </section>

      {availableRooms !== null && (
        <section>
          <h2>Availability results</h2>

          {availableRooms.length === 0 ? (
            <div className="empty-state">
              <p>
                No suitable rooms are available for the dates and guest numbers
                you selected.
              </p>
            </div>
          ) : (
            <div className="favourites-list">
              {availableRooms.map((room) => (
                <article className="favourite-card" key={room.id}>
                  <h3>{room.name}</h3>
                  {room.description && <p>{room.description}</p>}
                  <p>{formatPrice(room.base_price, room.currency)} per night</p>
                  <p>Available rooms: {room.available_rooms}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <p>
        <Link to="/hotels">Back to hotels</Link>
      </p>
    </main>
  );
}

export default HotelDetailsPage;
