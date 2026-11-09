import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getAuthToken, getLoggedInUser } from "../../services/auth";
import { apiRequest } from "../../services/api";

type DashboardStatistics = {
  bookings: {
    total_bookings: string | number;
    pending_bookings: string | number;
    confirmed_bookings: string | number;
    cancelled_bookings: string | number;
    rejected_bookings: string | number;
    completed_bookings: string | number;
  };
  revenue: {
    total_revenue: string | number;
    successful_payment_count: string | number;
  };
  branches: {
    total_branches: string | number;
    active_branches: string | number;
  };
  roomTypes: {
    total_room_types: string | number;
    active_room_types: string | number;
  };
  guests: {
    total_guests: string | number;
    active_guests: string | number;
  };
  administrators: {
    total_administrators: string | number;
    active_administrators: string | number;
  };
  recentBookings: {
    id: number;
    booking_reference: string;
    guest_full_name: string;
    guest_email: string;
    check_in: string;
    check_out: string;
    status: string;
    total_amount: string | number;
    currency: string;
    created_at: string;
  }[];
};

type DashboardResponse = {
  success: boolean;
  data: DashboardStatistics;
};

function formatNumber(value: string | number): string {
  return Number(value).toLocaleString("en-ZA");
}

function formatCurrency(value: string | number): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
  }).format(Number(value));
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function SuperAdminDashboardPage() {
  const user = getLoggedInUser();

  const [dashboard, setDashboard] = useState<DashboardStatistics | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDashboard() {
      const token = getAuthToken();

      if (!token) {
        setError("Your session could not be verified. Please sign in again.");
        setLoading(false);
        return;
      }

      try {
        const response = await apiRequest<DashboardResponse>(
          "/admin/dashboard",
          { token },
        );

        if (!response.success) {
          throw new Error("Unable to load dashboard statistics.");
        }

        setDashboard(response.data);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load dashboard statistics.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadDashboard();
  }, []);

  const overviewCards = dashboard
    ? [
        {
          label: "Total Bookings",
          value: formatNumber(dashboard.bookings.total_bookings),
          detail: `${formatNumber(dashboard.bookings.pending_bookings)} pending`,
          icon: "01",
        },
        {
          label: "Registered Guests",
          value: formatNumber(dashboard.guests.total_guests),
          detail: `${formatNumber(dashboard.guests.active_guests)} active accounts`,
          icon: "02",
        },
        {
          label: "Administrators",
          value: formatNumber(dashboard.administrators.total_administrators),
          detail: `${formatNumber(
            dashboard.administrators.active_administrators,
          )} active accounts`,
          icon: "03",
        },
        {
          label: "Hotel Branches",
          value: formatNumber(dashboard.branches.total_branches),
          detail: `${formatNumber(dashboard.branches.active_branches)} active branches`,
          icon: "04",
        },
      ]
    : [];

  return (
    <div className="super-admin-dashboard">
      <div className="super-admin-dashboard-heading">
        <div>
          <span className="admin-page-eyebrow">LITTLESPACE ADMINISTRATION</span>

          <h1>Super Admin Dashboard</h1>

          <p>
            Welcome back, {user?.full_name ?? "Super Admin"}. Here's an overview
            of LittleSpace Hotel.
          </p>
        </div>

        <span className="super-admin-welcome-label">Super Admin</span>
      </div>

      {loading && (
        <div className="super-admin-dashboard-message">
          Loading dashboard statistics...
        </div>
      )}

      {!loading && error && (
        <div className="super-admin-dashboard-error" role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </div>
      )}

      {!loading && dashboard && (
        <>
          <section className="super-admin-overview-section">
            <div className="super-admin-section-heading">
              <div>
                <h2>System Overview</h2>
                <p>Key figures across LittleSpace Hotel.</p>
              </div>
            </div>

            <div className="super-admin-overview-grid">
              {overviewCards.map((card) => (
                <div className="super-admin-overview-card" key={card.label}>
                  <div className="super-admin-overview-card-top">
                    <span>{card.label}</span>
                    <span>{card.icon}</span>
                  </div>

                  <strong>{card.value}</strong>
                  <p>{card.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="super-admin-details-grid">
            <div className="super-admin-detail-card">
              <h3>Booking Status</h3>

              <div className="super-admin-stat-row">
                <span>Confirmed</span>
                <strong>
                  {formatNumber(dashboard.bookings.confirmed_bookings)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Pending</span>
                <strong>
                  {formatNumber(dashboard.bookings.pending_bookings)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Completed</span>
                <strong>
                  {formatNumber(dashboard.bookings.completed_bookings)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Cancelled</span>
                <strong>
                  {formatNumber(dashboard.bookings.cancelled_bookings)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Rejected</span>
                <strong>
                  {formatNumber(dashboard.bookings.rejected_bookings)}
                </strong>
              </div>
            </div>

            <div className="super-admin-detail-card">
              <h3>Hotel Resources</h3>

              <div className="super-admin-stat-row">
                <span>Room Types</span>
                <strong>
                  {formatNumber(dashboard.roomTypes.total_room_types)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Active Room Types</span>
                <strong>
                  {formatNumber(dashboard.roomTypes.active_room_types)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Active Branches</span>
                <strong>
                  {formatNumber(dashboard.branches.active_branches)}
                </strong>
              </div>

              <div className="super-admin-stat-row">
                <span>Active Guests</span>
                <strong>{formatNumber(dashboard.guests.active_guests)}</strong>
              </div>
            </div>

            <div className="super-admin-detail-card super-admin-revenue-card">
              <h3>Payment Overview</h3>

              <span className="super-admin-revenue-label">
                Successful Payments
              </span>

              <strong>{formatCurrency(dashboard.revenue.total_revenue)}</strong>

              <p>
                {formatNumber(dashboard.revenue.successful_payment_count)}{" "}
                successful payments in ZAR
              </p>
            </div>
          </section>

          <section className="super-admin-recent-section">
            <div className="super-admin-section-heading">
              <div>
                <h2>Recent Bookings</h2>
                <p>The five most recently created bookings.</p>
              </div>

              <Link to="/admin/bookings">View all bookings</Link>
            </div>

            {dashboard.recentBookings.length === 0 ? (
              <div className="super-admin-empty-state">
                No bookings have been recorded yet.
              </div>
            ) : (
              <div className="super-admin-table-wrapper">
                <table className="super-admin-bookings-table">
                  <thead>
                    <tr>
                      <th>Booking Reference</th>
                      <th>Guest</th>
                      <th>Check-in</th>
                      <th>Check-out</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {dashboard.recentBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.booking_reference}</td>
                        <td>
                          <strong>{booking.guest_full_name}</strong>
                          <span>{booking.guest_email}</span>
                        </td>
                        <td>{formatDate(booking.check_in)}</td>
                        <td>{formatDate(booking.check_out)}</td>
                        <td>{formatCurrency(booking.total_amount)}</td>
                        <td>
                          <span
                            className={`super-admin-booking-status status-${booking.status.toLowerCase()}`}
                          >
                            {booking.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <div className="super-admin-dashboard-note">
            <div className="super-admin-note-mark">i</div>
            <p>
              As Super Admin, you have access to administrator management and
              all hotel operations.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export default SuperAdminDashboardPage;
