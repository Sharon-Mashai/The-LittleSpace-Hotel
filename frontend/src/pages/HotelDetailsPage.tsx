import { useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { getHotelBranches, type HotelBranch } from "../services/branches";
import { getBranchRoomTypes, type RoomType } from "../services/roomTypes";
import {
  checkRoomAvailability,
  type AvailableRoomType,
} from "../services/availability";
import { createBooking } from "../services/bookings";
import { initializePaystackPayment } from "../services/payments";
import {
  createReview,
  getBranchReviews,
  type BranchReviews,
} from "../services/reviews";
import {
  getBookingHistory,
  type GuestBookingHistory,
} from "../services/bookingHistory";
import { getAuthToken } from "../services/auth";

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

  const [selectedRoom, setSelectedRoom] = useState<AvailableRoomType | null>(
    null,
  );

  const [guestFullName, setGuestFullName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");

  const [loading, setLoading] = useState(true);
  const [checkingAvailability, setCheckingAvailability] = useState(false);
  const [creatingBooking, setCreatingBooking] = useState(false);

  const [error, setError] = useState("");
  const [availabilityError, setAvailabilityError] = useState("");
  const [bookingError, setBookingError] = useState("");

  // Review state
  const [reviewData, setReviewData] = useState<BranchReviews | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(true);
  const [reviewLoadError, setReviewLoadError] = useState("");

  const [bookingHistory, setBookingHistory] = useState<GuestBookingHistory[]>(
    [],
  );
  const [loadingBookingHistory, setLoadingBookingHistory] = useState(false);

  const [reviewBookingId, setReviewBookingId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitError, setReviewSubmitError] = useState("");
  const [reviewSubmitSuccess, setReviewSubmitSuccess] = useState("");

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

  // Load public reviews whenever the selected branch changes.
  useEffect(() => {
    if (!branch) return;

    let cancelled = false;

    async function loadReviews() {
      try {
        setLoadingReviews(true);
        setReviewLoadError("");

        const result = await getBranchReviews(branch!.id);

        if (!cancelled) {
          setReviewData(result);
        }
      } catch (err) {
        if (!cancelled) {
          setReviewLoadError(
            err instanceof Error ? err.message : "Unable to load reviews.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingReviews(false);
        }
      }
    }

    loadReviews();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  // Only signed-in guests can load their booking history for review eligibility.
  useEffect(() => {
    // Do not make a booking-history request when there is no signed-in guest.
    // bookingHistory already starts as an empty array.
    if (!branch || !getAuthToken()) {
      return;
    }

    let cancelled = false;

    async function loadGuestBookings() {
      try {
        setLoadingBookingHistory(true);

        const bookings = await getBookingHistory();

        if (!cancelled) {
          setBookingHistory(bookings);
        }
      } catch {
        if (!cancelled) {
          setBookingHistory([]);
        }
      } finally {
        if (!cancelled) {
          setLoadingBookingHistory(false);
        }
      }
    }

    loadGuestBookings();

    return () => {
      cancelled = true;
    };
  }, [branch]);

  async function handleAvailabilitySearch(event: FormEvent<HTMLFormElement>) {
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
      setSelectedRoom(null);
      setBookingError("");

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

  function formatReviewDate(date: string) {
    return new Date(date).toLocaleDateString("en-ZA", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  async function handleBookingSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!branch || !selectedRoom) {
      setBookingError("Please select an available room first.");
      return;
    }

    if (!guestFullName.trim() || !guestEmail.trim() || !guestPhone.trim()) {
      setBookingError(
        "Please enter your name, email address and phone number.",
      );
      return;
    }

    try {
      setCreatingBooking(true);
      setBookingError("");

      const booking = await createBooking({
        branchId: Number(branch.id),
        roomTypeId: Number(selectedRoom.id),
        checkIn,
        checkOut,
        adults,
        children,
        guestFullName: guestFullName.trim(),
        guestEmail: guestEmail.trim().toLowerCase(),
        guestPhone: guestPhone.trim(),
        specialRequests: specialRequests.trim() || undefined,
      });

      sessionStorage.setItem(
        "littlespace_guest_email",
        guestEmail.trim().toLowerCase(),
      );

      const payment = await initializePaystackPayment(
        booking.id,
        guestEmail.trim().toLowerCase(),
      );

      window.location.assign(payment.data.authorizationUrl);
    } catch (err) {
      setBookingError(
        err instanceof Error
          ? err.message
          : "We could not create your booking or initialize payment. Please try again.",
      );
      setCreatingBooking(false);
    }
  }

  // Completed bookings at this branch that have not already been reviewed.
  const reviewedBookingIds = new Set(
    reviewData?.reviews.map((review) => Number(review.booking_id)) ?? [],
  );

  const eligibleBookings = bookingHistory.filter(
    (booking) =>
      booking.status === "completed" &&
      booking.rooms.some(
        (room) => Number(room.branchId) === Number(branch?.id),
      ) &&
      !reviewedBookingIds.has(Number(booking.booking_id)),
  );

  async function handleReviewSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!branch) return;

    if (!getAuthToken()) {
      setReviewSubmitError("Please sign in before submitting a review.");
      return;
    }

    if (!reviewBookingId) {
      setReviewSubmitError(
        "Please select the completed booking you want to review.",
      );
      return;
    }

    if (!reviewComment.trim()) {
      setReviewSubmitError(
        "Please write a comment before submitting your review.",
      );
      return;
    }

    try {
      setSubmittingReview(true);
      setReviewSubmitError("");
      setReviewSubmitSuccess("");

      await createReview({
        bookingId: Number(reviewBookingId),
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      const updatedReviews = await getBranchReviews(branch.id);
      setReviewData(updatedReviews);

      const updatedBookings = await getBookingHistory();
      setBookingHistory(updatedBookings);

      setReviewBookingId("");
      setReviewRating(5);
      setReviewComment("");
      setReviewSubmitSuccess("Your review has been submitted successfully.");
    } catch (err) {
      setReviewSubmitError(
        err instanceof Error
          ? err.message
          : "Unable to submit your review. Please try again.",
      );
    } finally {
      setSubmittingReview(false);
    }
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

  const reviewCount = reviewData?.summary.review_count ?? 0;
  const averageRating = Number(reviewData?.summary.average_rating ?? 0);

  const ratingCounts = [5, 4, 3, 2, 1].map((rating) => ({
    rating,
    count:
      reviewData?.reviews.filter((review) => review.rating === rating).length ??
      0,
  }));

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

      {/* Reviews and rating summary */}
      <section className="hotel-reviews-section">
        <div className="account-page-heading">
          <h2>Guest reviews</h2>
          <p>Read about other guests' experiences at this branch.</p>
        </div>

        {loadingReviews ? (
          <div className="empty-state">
            <p>Loading guest reviews...</p>
          </div>
        ) : reviewLoadError ? (
          <div className="empty-state">
            <p role="alert">{reviewLoadError}</p>
          </div>
        ) : (
          <div className="hotel-reviews-layout">
            <aside className="review-summary">
              <h3>Overall rating</h3>

              <p className="review-average">
                {averageRating.toFixed(1)}
                <span>/ 5</span>
              </p>

              <p
                className="review-stars"
                aria-label={`${averageRating} out of 5 stars`}
              >
                {"★".repeat(Math.round(averageRating))}
                {"☆".repeat(5 - Math.round(averageRating))}
              </p>

              <p>
                Based on {reviewCount}{" "}
                {reviewCount === 1 ? "review" : "reviews"}
              </p>

              <div className="rating-breakdown">
                {ratingCounts.map(({ rating, count }) => (
                  <div className="rating-breakdown-row" key={rating}>
                    <span>{rating} stars</span>
                    <div className="rating-breakdown-track">
                      <div
                        className="rating-breakdown-fill"
                        style={{
                          width: `${
                            reviewCount > 0 ? (count / reviewCount) * 100 : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span>{count}</span>
                  </div>
                ))}
              </div>
            </aside>

            <div className="review-list">
              <h3>What our guests say</h3>

              {reviewData?.reviews.length ? (
                reviewData.reviews.map((review) => (
                  <article className="review-card" key={review.id}>
                    <div className="review-card-heading">
                      <div>
                        <h4>{review.reviewer_name}</h4>
                        <p>{formatReviewDate(review.created_at)}</p>
                      </div>

                      <span className="review-card-rating">
                        {"★".repeat(review.rating)}
                        {"☆".repeat(5 - review.rating)}
                      </span>
                    </div>

                    {review.comment ? (
                      <p>{review.comment}</p>
                    ) : (
                      <p>No written comment was provided.</p>
                    )}
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <p>No reviews have been submitted for this branch yet.</p>
                  <p>
                    Be the first guest to share your experience after your stay.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Review submission form */}
      <section className="empty-state review-form-section">
        <h2>Write a review</h2>
        <p>
          Reviews are available to signed-in guests who have completed a stay at
          this branch.
        </p>

        {!getAuthToken() ? (
          <p>
            Please <Link to="/sign-in">sign in</Link> to leave a review.
          </p>
        ) : loadingBookingHistory ? (
          <p>Checking your completed bookings...</p>
        ) : eligibleBookings.length === 0 ? (
          <p>
            You do not currently have an eligible completed booking at this
            branch to review. Once you complete a stay, you can share your
            experience here.
          </p>
        ) : (
          <form onSubmit={handleReviewSubmit}>
            <div>
              <label htmlFor="reviewBooking">Completed booking</label>
              <select
                id="reviewBooking"
                value={reviewBookingId}
                onChange={(event) => setReviewBookingId(event.target.value)}
                required
              >
                <option value="">Select a completed booking</option>
                {eligibleBookings.map((booking) => (
                  <option key={booking.booking_id} value={booking.booking_id}>
                    {booking.booking_reference} —{" "}
                    {formatReviewDate(booking.check_in)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="reviewRating">Your rating</label>
              <select
                id="reviewRating"
                value={reviewRating}
                onChange={(event) =>
                  setReviewRating(Number(event.target.value))
                }
                required
              >
                <option value={5}>5 - Excellent</option>
                <option value={4}>4 - Very good</option>
                <option value={3}>3 - Good</option>
                <option value={2}>2 - Fair</option>
                <option value={1}>1 - Poor</option>
              </select>
            </div>

            <div>
              <label htmlFor="reviewComment">Your written review</label>
              <textarea
                id="reviewComment"
                value={reviewComment}
                onChange={(event) => setReviewComment(event.target.value)}
                rows={5}
                placeholder="Tell us about your stay at this branch..."
                required
              />
            </div>

            {reviewSubmitError && <p role="alert">{reviewSubmitError}</p>}

            {reviewSubmitSuccess && <p role="status">{reviewSubmitSuccess}</p>}

            <button
              className="primary-button"
              type="submit"
              disabled={submittingReview}
            >
              {submittingReview ? "Submitting review..." : "Submit review"}
            </button>
          </form>
        )}
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

                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      setSelectedRoom(room);
                      setBookingError("");
                    }}
                  >
                    {selectedRoom?.id === room.id
                      ? "Room selected"
                      : "Select this room"}
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {selectedRoom && (
        <section className="empty-state">
          <h2>Complete your booking</h2>

          <p>
            Selected room: <strong>{selectedRoom.name}</strong>
          </p>

          <p>
            Price per night:{" "}
            <strong>
              {formatPrice(selectedRoom.base_price, selectedRoom.currency)}
            </strong>
          </p>

          <p>
            Please enter your contact details before proceeding to payment. You
            can book as a guest without creating an account.
          </p>

          <form onSubmit={handleBookingSubmit}>
            <div>
              <label htmlFor="guestFullName">Full name</label>
              <input
                id="guestFullName"
                type="text"
                value={guestFullName}
                onChange={(event) => setGuestFullName(event.target.value)}
                autoComplete="name"
                required
              />
            </div>

            <div>
              <label htmlFor="guestEmail">Email address</label>
              <input
                id="guestEmail"
                type="email"
                value={guestEmail}
                onChange={(event) => setGuestEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            <div>
              <label htmlFor="guestPhone">Phone number</label>
              <input
                id="guestPhone"
                type="tel"
                value={guestPhone}
                onChange={(event) => setGuestPhone(event.target.value)}
                autoComplete="tel"
                required
              />
            </div>

            <div>
              <label htmlFor="specialRequests">
                Special requests (optional)
              </label>
              <textarea
                id="specialRequests"
                value={specialRequests}
                onChange={(event) => setSpecialRequests(event.target.value)}
                rows={3}
              />
            </div>

            {bookingError && <p role="alert">{bookingError}</p>}

            <button
              className="primary-button"
              type="submit"
              disabled={creatingBooking}
            >
              {creatingBooking
                ? "Preparing your payment..."
                : "Continue to payment"}
            </button>
          </form>
        </section>
      )}

      <p>
        <Link to="/hotels">Back to hotels</Link>
      </p>
    </main>
  );
}

export default HotelDetailsPage;
