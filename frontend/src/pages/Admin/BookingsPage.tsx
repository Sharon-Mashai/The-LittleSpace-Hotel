import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAuthToken } from "../../services/auth";
import ConfirmationModal from "../../components/ConfirmationModal";
import Toast from "../../components/Toast";
import {
  getAdminPermissions,
  type AdminPermission,
} from "../../services/adminPermissions";

type BookingRoom = {
  roomId: number;
  roomNumber: string;
  roomTypeId: number;
  roomTypeName: string;
  nightlyPrice: number | string;
};

type AdminBooking = {
  id: number;
  booking_reference: string;
  user_id: number | null;
  guest_full_name: string;
  guest_email: string;
  guest_phone: string;
  check_in: string;
  check_out: string;
  adults: number;
  children: number;
  status: string;
  special_requests: string | null;
  total_amount: number | string;
  currency: string;
  created_at: string;
  branch_id: number | null;
  branch_name: string | null;
  rooms: BookingRoom[];
};

type BookingsResponse = {
  success: boolean;
  count: number;
  data: AdminBooking[];
};

type BookingUpdateResponse = {
  success: boolean;
  message: string;
  data: {
    id: number;
    booking_reference: string;
    status: string;
  };
};

type BookingAction = "confirmed" | "cancelled" | "rejected";

type PendingAction = {
  booking: AdminBooking;
  status: BookingAction;
};

function formatDate(date: string): string {
  if (!date) return "Not available";

  const dateOnly = date.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);

  if (!match) return "Not available";

  const [, year, month, day] = match;

  const localDate = new Date(Number(year), Number(month) - 1, Number(day));

  return localDate.toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatCurrency(amount: number | string, currency: string): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: currency || "ZAR",
  }).format(Number(amount));
}

function BookingsPage() {
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingBookingId, setUpdatingBookingId] = useState<number | null>(
    null,
  );
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const canConfirm = permissions.includes("bookings.confirm");
  const canCancel = permissions.includes("bookings.cancel");
  const canReject = permissions.includes("bookings.reject");

  const isUpdating = updatingBookingId !== null;

  useEffect(() => {
    let isMounted = true;

    async function loadBookings() {
      const token = getAuthToken();

      if (!token) {
        if (isMounted) {
          setError("Your login session has expired. Please sign in again.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const [bookingResponse, assignedPermissions] = await Promise.all([
          apiRequest<BookingsResponse>("/admin/bookings", {
            method: "GET",
            token,
          }),
          getAdminPermissions(),
        ]);

        if (isMounted) {
          setBookings(bookingResponse.data);
          setPermissions(assignedPermissions);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load bookings.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadBookings();

    return () => {
      isMounted = false;
    };
  }, []);

  function openConfirmationModal(booking: AdminBooking, status: BookingAction) {
    setError("");
    setSuccessMessage("");
    setPendingAction({ booking, status });
  }

  async function updateBookingStatus(
    booking: AdminBooking,
    newStatus: BookingAction,
  ) {
    const token = getAuthToken();

    if (!token) {
      setError("Your login session has expired. Please sign in again.");
      return;
    }

    setUpdatingBookingId(booking.id);
    setError("");
    setSuccessMessage("");

    try {
      const response = await apiRequest<BookingUpdateResponse>(
        `/admin/bookings/${booking.id}/status`,
        {
          method: "PATCH",
          token,
          body: { status: newStatus },
        },
      );

      setBookings((currentBookings) =>
        currentBookings.map((currentBooking) =>
          currentBooking.id === booking.id
            ? { ...currentBooking, status: response.data.status }
            : currentBooking,
        ),
      );

      setSuccessMessage(response.message);
      setPendingAction(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update this booking.",
      );
    } finally {
      setUpdatingBookingId(null);
    }
  }

  if (isLoading) {
    return (
      <div className="admin-page">
        <p>Loading bookings...</p>
      </div>
    );
  }

  if (error && bookings.length === 0) {
    return (
      <div className="admin-page">
        <h1>Bookings</h1>
        <p className="admin-message admin-message-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  const modalContent = pendingAction
    ? {
        confirmed: {
          title: "Confirm this booking?",
          message: `Are you sure you want to confirm booking ${pendingAction.booking.booking_reference}? The guest will receive a booking confirmation email. Make sure the payment has been successful.`,
          buttonText: "Yes, confirm booking",
        },
        cancelled: {
          title: "Cancel this booking?",
          message: `Are you sure you want to cancel booking ${pendingAction.booking.booking_reference}? This action will update the booking status. Any successful payment will not be automatically refunded.`,
          buttonText: "Yes, cancel booking",
        },
        rejected: {
          title: "Reject this booking?",
          message: `Are you sure you want to reject booking ${pendingAction.booking.booking_reference}?`,
          buttonText: "Yes, reject booking",
        },
      }[pendingAction.status]
    : null;

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">LITTLESPACE HOTEL</p>
          <h1>Bookings</h1>
          <p>View and manage guest reservations.</p>
        </div>

        <div className="admin-booking-count">
          <strong>{bookings.length}</strong>
          <span>Total bookings</span>
        </div>
      </div>

      {error && (
        <p className="admin-message admin-message-error" role="alert">
          {error}
        </p>
      )}

      <Toast
        message={successMessage}
        onDismiss={() => setSuccessMessage("")}
      />

      {bookings.length === 0 ? (
        <div className="admin-empty-state">
          <h2>No bookings found</h2>
          <p>Guest reservations will appear here when they are made.</p>
        </div>
      ) : (
        <div className="admin-bookings-list">
          {bookings.map((booking) => {
            const bookingIsUpdating = updatingBookingId === booking.id;
            const isPending = booking.status === "pending";
            const canBeCancelled = isPending || booking.status === "confirmed";

            return (
              <article className="admin-booking-card" key={booking.id}>
                <div className="admin-booking-header">
                  <div>
                    <span className="admin-booking-reference">
                      {booking.booking_reference}
                    </span>
                    <h2>{booking.guest_full_name}</h2>
                    <p>{booking.guest_email}</p>
                    <p>{booking.guest_phone}</p>
                  </div>

                  <span
                    className={`admin-booking-status status-${booking.status}`}
                  >
                    {booking.status.replaceAll("_", " ")}
                  </span>
                </div>

                <div className="admin-booking-details">
                  <div>
                    <span>Branch</span>
                    <strong>{booking.branch_name || "Not available"}</strong>
                  </div>

                  <div>
                    <span>Check-in</span>
                    <strong>{formatDate(booking.check_in)}</strong>
                  </div>

                  <div>
                    <span>Check-out</span>
                    <strong>{formatDate(booking.check_out)}</strong>
                  </div>

                  <div>
                    <span>Guests</span>
                    <strong>
                      {booking.adults} adults, {booking.children} children
                    </strong>
                  </div>

                  <div>
                    <span>Rooms</span>
                    <strong>{booking.rooms.length}</strong>
                  </div>

                  <div>
                    <span>Total amount</span>
                    <strong>
                      {formatCurrency(booking.total_amount, booking.currency)}
                    </strong>
                  </div>
                </div>

                {booking.rooms.length > 0 && (
                  <div className="admin-booking-rooms">
                    <h3>Room details</h3>

                    {booking.rooms.map((room) => (
                      <div key={room.roomId}>
                        <span>
                          Room {room.roomNumber} – {room.roomTypeName}
                        </span>
                        <strong>
                          {formatCurrency(room.nightlyPrice, booking.currency)}
                          {" / night"}
                        </strong>
                      </div>
                    ))}
                  </div>
                )}

                {booking.special_requests && (
                  <div className="admin-special-requests">
                    <strong>Special requests</strong>
                    <p>{booking.special_requests}</p>
                  </div>
                )}

                <div className="admin-booking-footer">
                  <span>Booked on: {formatDate(booking.created_at)}</span>

                  <div className="admin-booking-actions">
                    {canConfirm && isPending && (
                      <button
                        type="button"
                        className="admin-action-button confirm-button"
                        disabled={bookingIsUpdating || isUpdating}
                        onClick={() =>
                          openConfirmationModal(booking, "confirmed")
                        }
                      >
                        {bookingIsUpdating ? "Updating..." : "Confirm booking"}
                      </button>
                    )}

                    {canCancel && canBeCancelled && (
                      <button
                        type="button"
                        className="admin-action-button cancel-button"
                        disabled={bookingIsUpdating || isUpdating}
                        onClick={() =>
                          openConfirmationModal(booking, "cancelled")
                        }
                      >
                        {bookingIsUpdating ? "Updating..." : "Cancel booking"}
                      </button>
                    )}

                    {canReject && isPending && (
                      <button
                        type="button"
                        className="admin-action-button reject-button"
                        disabled={bookingIsUpdating || isUpdating}
                        onClick={() =>
                          openConfirmationModal(booking, "rejected")
                        }
                      >
                        {bookingIsUpdating ? "Updating..." : "Reject booking"}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {pendingAction && modalContent && (
        <ConfirmationModal
          title={modalContent.title}
          message={modalContent.message}
          confirmText={modalContent.buttonText}
          icon={pendingAction.status === "confirmed" ? "✓" : "!"}
          variant={pendingAction.status === "confirmed" ? "confirm" : "danger"}
          isBusy={isUpdating}
          error={error}
          onCancel={() => {
            setPendingAction(null);
            setError("");
          }}
          onConfirm={() =>
            updateBookingStatus(pendingAction.booking, pendingAction.status)
          }
        />
      )}
    </div>
  );
}

export default BookingsPage;
