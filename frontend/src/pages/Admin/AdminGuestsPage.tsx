import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAuthToken } from "../../services/auth";

type AdminGuest = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  created_at: string;
};

type GuestsResponse = {
  success: boolean;
  count: number;
  data: AdminGuest[];
};

function formatDate(date: string): string {
  if (!date) return "Not available";

  return new Date(date).toLocaleDateString("en-ZA", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function AdminGuestsPage() {
  const [guests, setGuests] = useState<AdminGuest[]>([]);
  const [search, setSearch] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadGuests() {
      const token = getAuthToken();

      if (!token) {
        if (isMounted) {
          setError("Your login session has expired. Please sign in again.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await apiRequest<GuestsResponse>("/admin/guests", {
          method: "GET",
          token,
        });

        if (isMounted) {
          setGuests(response.data);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load guest records.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadGuests();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredGuests = guests.filter((guest) => {
    const searchTerm = search.trim().toLowerCase();

    return (
      guest.full_name.toLowerCase().includes(searchTerm) ||
      guest.email.toLowerCase().includes(searchTerm) ||
      (guest.phone ?? "").toLowerCase().includes(searchTerm)
    );
  });

  if (isLoading) {
    return (
      <div className="admin-page">
        <p>Loading guest records...</p>
      </div>
    );
  }

  if (error && guests.length === 0) {
    return (
      <div className="admin-page">
        <h1>Guests</h1>
        <p className="admin-message admin-message-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">LITTLESPACE HOTEL</p>
          <h1>Guests</h1>
          <p>View and review registered guest records.</p>
        </div>

        <div className="admin-booking-count">
          <strong>{guests.length}</strong>
          <span>Total guests</span>
        </div>
      </div>

      <section className="admin-guests-section">
        <div className="admin-guests-toolbar">
          <div>
            <h2>Guest Directory</h2>
            <p>Registered guests and their contact information.</p>
          </div>

          <input
            type="search"
            className="admin-guests-search"
            placeholder="Search guests..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search guests by name, email or phone"
          />
        </div>

        {filteredGuests.length === 0 ? (
          <div className="admin-empty-state">
            <h2>{search ? "No matching guests" : "No guests found"}</h2>
            <p>
              {search
                ? "Try another name, email address or phone number."
                : "Registered guest records will appear here."}
            </p>
          </div>
        ) : (
          <div className="admin-guests-table-wrapper">
            <table className="admin-guests-table">
              <thead>
                <tr>
                  <th>Guest</th>
                  <th>Email address</th>
                  <th>Phone number</th>
                  <th>Registered</th>
                </tr>
              </thead>

              <tbody>
                {filteredGuests.map((guest) => (
                  <tr key={guest.id}>
                    <td>
                      <div className="admin-guest-name">
                        <span className="admin-guest-avatar">
                          {guest.full_name.charAt(0).toUpperCase()}
                        </span>
                        <span>{guest.full_name}</span>
                      </div>
                    </td>

                    <td>{guest.email}</td>
                    <td>{guest.phone || "Not provided"}</td>
                    <td>{formatDate(guest.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="admin-guests-table-footer">
          Showing {filteredGuests.length} of {guests.length} guests
        </div>
      </section>
    </div>
  );
}

export default AdminGuestsPage;
