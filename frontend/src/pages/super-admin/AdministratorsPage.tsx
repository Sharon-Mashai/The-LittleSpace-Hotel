import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { apiRequest } from "../../services/api";
import { getAuthToken } from "../../services/auth";

type Administrator = {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  role: "admin" | "super_admin";
  is_active: boolean;
  created_at: string;
  updated_at?: string;
};

type AdministratorsResponse = {
  success: boolean;
  count: number;
  data: Administrator[];
};

type CreateAdministratorResponse = {
  success: boolean;
  message: string;
  data: Administrator;
};

function AdministratorsPage() {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [search, setSearch] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Load administrator accounts when the page opens or search changes.
  useEffect(() => {
    let cancelled = false;

    async function fetchAdministrators() {
      const token = getAuthToken();

      if (!token) {
        if (!cancelled) {
          setError("Your session has expired. Please sign in again.");
          setLoading(false);
        }
        return;
      }

      try {
        const query = search.trim()
          ? `?search=${encodeURIComponent(search.trim())}`
          : "";

        const response = await apiRequest<AdministratorsResponse>(
          `/admin/administrators${query}`,
          { token },
        );

        if (!cancelled) {
          setAdministrators(response.data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load administrator accounts.",
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void fetchAdministrators();

    return () => {
      cancelled = true;
    };
  }, [search]);

  // Refresh the administrator list after creating an account.
  const loadAdministrators = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setLoading(true);
      setError("");

      const query = search.trim()
        ? `?search=${encodeURIComponent(search.trim())}`
        : "";

      const response = await apiRequest<AdministratorsResponse>(
        `/admin/administrators${query}`,
        { token },
      );

      setAdministrators(response.data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load administrator accounts.",
      );
    } finally {
      setLoading(false);
    }
  }, [search]);

  async function handleCreateAdministrator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAuthToken();

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setCreating(true);
      setError("");
      setSuccessMessage("");

      const response = await apiRequest<CreateAdministratorResponse>(
        "/admin/administrators",
        {
          method: "POST",
          token,
          body: {
            fullName,
            email,
            password,
            phone: phone.trim() || undefined,
          },
        },
      );

      setSuccessMessage(response.message);

      setFullName("");
      setEmail("");
      setPhone("");
      setPassword("");

      await loadAdministrators();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create administrator account.",
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h1>Administrator Management</h1>
        <p>
          View administrator accounts and create new Admin accounts for
          LittleSpace Hotel.
        </p>
      </div>

      {error && (
        <p role="alert" className="admin-error">
          {error}
        </p>
      )}

      {successMessage && (
        <p role="status" className="admin-success">
          {successMessage}
        </p>
      )}

      <section className="admin-section">
        <h2>Administrator Accounts</h2>

        <div className="admin-search">
          <label htmlFor="administrator-search">Search by name or email</label>

          <input
            id="administrator-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Enter a name or email"
          />
        </div>

        {loading ? (
          <p>Loading administrator accounts...</p>
        ) : administrators.length === 0 ? (
          <p>No administrator accounts found.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Role</th>
                  <th>Status</th>
                </tr>
              </thead>

              <tbody>
                {administrators.map((administrator) => (
                  <tr key={administrator.id}>
                    <td>{administrator.full_name}</td>
                    <td>{administrator.email}</td>
                    <td>{administrator.phone || "Not provided"}</td>
                    <td>
                      {administrator.role === "super_admin"
                        ? "Super Admin"
                        : "Admin"}
                    </td>
                    <td>{administrator.is_active ? "Active" : "Inactive"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={() => void loadAdministrators()}
          disabled={loading}
        >
          Refresh list
        </button>
      </section>

      <section className="admin-section">
        <h2>Create Admin Account</h2>

        <form onSubmit={handleCreateAdministrator}>
          <div>
            <label htmlFor="admin-full-name">Full name</label>
            <input
              id="admin-full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </div>

          <div>
            <label htmlFor="admin-phone">Phone number (optional)</label>
            <input
              id="admin-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
          </div>

          <div>
            <label htmlFor="admin-password">Temporary password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
            <small>
              Use at least 8 characters. The password must not exceed 72 UTF-8
              bytes.
            </small>
          </div>

          <button type="submit" disabled={creating}>
            {creating ? "Creating account..." : "Create Admin Account"}
          </button>
        </form>
      </section>
    </div>
  );
}

export default AdministratorsPage;
