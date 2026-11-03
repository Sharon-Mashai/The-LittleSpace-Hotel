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

  // Refresh the administrator list manually or after creating an account.
  const loadAdministrators = useCallback(async () => {
    const token = getAuthToken();

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      setLoading(false);
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
    <div className="admin-management-page">
      <div className="admin-management-heading">
        <div>
          <span className="admin-page-eyebrow">SUPER ADMINISTRATION</span>
          <h1>Administrator Management</h1>
          <p>
            Manage administrator accounts and create new Admin accounts for
            LittleSpace Hotel.
          </p>
        </div>
      </div>

      {error && (
        <div role="alert" className="admin-management-message error">
          <strong>Something went wrong</strong>
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div role="status" className="admin-management-message success">
          <strong>Success</strong>
          <span>{successMessage}</span>
        </div>
      )}

      <section className="admin-management-card">
        <div className="admin-card-heading">
          <div>
            <span className="admin-card-eyebrow">ACCOUNT DIRECTORY</span>
            <h2>Administrator Accounts</h2>
            <p>View and search the administrator accounts in your system.</p>
          </div>

          <span className="admin-account-count">
            {administrators.length}{" "}
            {administrators.length === 1 ? "account" : "accounts"}
          </span>
        </div>

        <div className="admin-management-toolbar">
          <div className="admin-management-search">
            <label htmlFor="administrator-search">Search administrators</label>
            <input
              id="administrator-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name or email..."
            />
          </div>

          <button
            type="button"
            className="admin-secondary-button"
            onClick={() => void loadAdministrators()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh list"}
          </button>
        </div>

        {loading ? (
          <div className="admin-management-empty">
            <p>Loading administrator accounts...</p>
          </div>
        ) : administrators.length === 0 ? (
          <div className="admin-management-empty">
            <h3>No administrator accounts found</h3>
            <p>
              Try another search or create a new Admin account using the form
              below.
            </p>
          </div>
        ) : (
          <div className="admin-management-table-wrapper">
            <table className="admin-management-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Contact details</th>
                  <th>Role</th>
                  <th>Account status</th>
                </tr>
              </thead>

              <tbody>
                {administrators.map((administrator) => (
                  <tr key={administrator.id}>
                    <td>
                      <div className="admin-person-cell">
                        <span className="admin-person-avatar">
                          {administrator.full_name
                            .trim()
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                        <span className="admin-person-name">
                          {administrator.full_name}
                        </span>
                      </div>
                    </td>

                    <td>
                      <div className="admin-contact-cell">
                        <span>{administrator.email}</span>
                        <small>
                          {administrator.phone || "No phone number provided"}
                        </small>
                      </div>
                    </td>

                    <td>
                      <span
                        className={`admin-role-label ${
                          administrator.role === "super_admin"
                            ? "super-admin"
                            : "admin"
                        }`}
                      >
                        {administrator.role === "super_admin"
                          ? "Super Admin"
                          : "Admin"}
                      </span>
                    </td>

                    <td>
                      <span
                        className={`admin-account-status ${
                          administrator.is_active ? "active" : "inactive"
                        }`}
                      >
                        <span className="admin-status-dot" />
                        {administrator.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-management-card admin-create-card">
        <div className="admin-card-heading">
          <div>
            <span className="admin-card-eyebrow">NEW ACCOUNT</span>
            <h2>Create Admin Account</h2>
            <p>
              Add a new administrator who can access the management portal. You
              can assign their individual permissions separately.
            </p>
          </div>
        </div>

        <form
          className="admin-create-form"
          onSubmit={handleCreateAdministrator}
        >
          <div className="admin-form-field">
            <label htmlFor="admin-full-name">Full name</label>
            <input
              id="admin-full-name"
              type="text"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              placeholder="Enter the administrator's full name"
              autoComplete="name"
              required
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="admin-email">Email address</label>
            <input
              id="admin-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
            />
          </div>

          <div className="admin-form-field">
            <label htmlFor="admin-phone">Phone number</label>
            <input
              id="admin-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="Enter phone number (optional)"
              autoComplete="tel"
            />
            <small>Optional</small>
          </div>

          <div className="admin-form-field">
            <label htmlFor="admin-password">Temporary password</label>
            <input
              id="admin-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              placeholder="Create a temporary password"
              required
            />
            <small>
              Use at least 8 characters. The password must not exceed 72 UTF-8
              bytes.
            </small>
          </div>

          <div className="admin-form-footer">
            <p>
              The new administrator's permissions can be configured after the
              account has been created.
            </p>

            <button
              type="submit"
              className="admin-primary-button"
              disabled={creating}
            >
              {creating ? "Creating account..." : "Create Admin Account"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default AdministratorsPage;
