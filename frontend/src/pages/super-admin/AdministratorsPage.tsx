
import { useCallback, useEffect, useRef, useState } from "react";
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

type AdministratorResponse = {
  success: boolean;
  message: string;
  data: Administrator;
};

type EditAdministratorForm = {
  fullName: string;
  email: string;
  phone: string;
};

function AdministratorsPage() {
  const [administrators, setAdministrators] = useState<Administrator[]>([]);
  const [search, setSearch] = useState("");

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");

  const [editingAdministrator, setEditingAdministrator] =
    useState<Administrator | null>(null);

  const [editForm, setEditForm] = useState<EditAdministratorForm>({
    fullName: "",
    email: "",
    phone: "",
  });

  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement | null>(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

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

  // Load administrator accounts whenever the search value changes.
  useEffect(() => {
    let cancelled = false;

    async function fetchAdministrators() {
      await Promise.resolve();

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

  // Close the dropdown when the user clicks outside it or presses Escape.
  useEffect(() => {
    if (openMenuId === null) return;

    function handleOutsideClick(event: MouseEvent) {
      if (
        actionsMenuRef.current &&
        !actionsMenuRef.current.contains(event.target as Node)
      ) {
        setOpenMenuId(null);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenMenuId(null);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscapeKey);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [openMenuId]);

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

      const response = await apiRequest<AdministratorResponse>(
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

  function openEditModal(administrator: Administrator) {
    setOpenMenuId(null);
    setEditingAdministrator(administrator);
    setEditForm({
      fullName: administrator.full_name,
      email: administrator.email,
      phone: administrator.phone ?? "",
    });
    setError("");
    setSuccessMessage("");
  }

  function closeEditModal() {
    if (savingEdit) return;

    setEditingAdministrator(null);
    setEditForm({
      fullName: "",
      email: "",
      phone: "",
    });
  }

  async function handleEditAdministrator(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingAdministrator) return;

    const token = getAuthToken();

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    try {
      setSavingEdit(true);
      setError("");
      setSuccessMessage("");

      const response = await apiRequest<AdministratorResponse>(
        `/admin/administrators/${editingAdministrator.id}`,
        {
          method: "PUT",
          token,
          body: {
            fullName: editForm.fullName.trim(),
            email: editForm.email.trim(),
            phone: editForm.phone.trim() || null,
          },
        },
      );

      setSuccessMessage(response.message);
      setEditingAdministrator(null);

      await loadAdministrators();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update administrator details.",
      );
    } finally {
      setSavingEdit(false);
    }
  }

  async function handleToggleStatus(administrator: Administrator) {
    const token = getAuthToken();

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const nextStatus = !administrator.is_active;
    const action = nextStatus ? "enable" : "disable";

    const confirmed = window.confirm(
      `Are you sure you want to ${action} ${administrator.full_name}'s account?`,
    );

    if (!confirmed) return;

    try {
      setChangingStatusId(administrator.id);
      setError("");
      setSuccessMessage("");

      const response = await apiRequest<AdministratorResponse>(
        `/admin/administrators/${administrator.id}/status`,
        {
          method: "PATCH",
          token,
          body: {
            isActive: nextStatus,
          },
        },
      );

      setSuccessMessage(response.message);
      await loadAdministrators();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to change administrator account status.",
      );
    } finally {
      setChangingStatusId(null);
    }
  }

  async function handleDeleteAdministrator(administrator: Administrator) {
    const token = getAuthToken();

    if (!token) {
      setError("Your session has expired. Please sign in again.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to permanently delete ${administrator.full_name}'s account?\n\nThis action cannot be undone. Accounts linked to bookings or reviews cannot be deleted.`,
    );

    if (!confirmed) return;

    try {
      setDeletingId(administrator.id);
      setError("");
      setSuccessMessage("");

      const response = await apiRequest<AdministratorResponse>(
        `/admin/administrators/${administrator.id}`,
        {
          method: "DELETE",
          token,
        },
      );

      setSuccessMessage(response.message);
      await loadAdministrators();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to delete administrator account.",
      );
    } finally {
      setDeletingId(null);
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
            <p>View, search and manage administrator accounts.</p>
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
                  <th>Actions</th>
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

                    <td>
                      {administrator.role === "admin" ? (
                        <div
                          className="admin-actions-menu"
                          ref={
                            openMenuId === administrator.id
                              ? actionsMenuRef
                              : null
                          }
                        >
                          <button
                            type="button"
                            className="admin-actions-menu-trigger"
                            aria-label={`Actions for ${administrator.full_name}`}
                            aria-haspopup="menu"
                            aria-expanded={openMenuId === administrator.id}
                            onClick={() =>
                              setOpenMenuId((current) =>
                                current === administrator.id
                                  ? null
                                  : administrator.id,
                              )
                            }
                            disabled={
                              savingEdit ||
                              changingStatusId === administrator.id ||
                              deletingId === administrator.id
                            }
                          >
                            <span aria-hidden="true">⋮</span>
                          </button>

                          {openMenuId === administrator.id && (
                            <div
                              className="admin-actions-dropdown"
                              role="menu"
                            >
                              <button
                                type="button"
                                className="admin-dropdown-item"
                                role="menuitem"
                                onClick={() => openEditModal(administrator)}
                                disabled={
                                  savingEdit ||
                                  changingStatusId === administrator.id ||
                                  deletingId === administrator.id
                                }
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                className="admin-dropdown-item"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void handleToggleStatus(administrator);
                                }}
                                disabled={
                                  changingStatusId === administrator.id ||
                                  deletingId === administrator.id
                                }
                              >
                                {changingStatusId === administrator.id
                                  ? "Updating..."
                                  : administrator.is_active
                                    ? "Disable"
                                    : "Enable"}
                              </button>

                              <button
                                type="button"
                                className="admin-dropdown-item danger"
                                role="menuitem"
                                onClick={() => {
                                  setOpenMenuId(null);
                                  void handleDeleteAdministrator(administrator);
                                }}
                                disabled={
                                  deletingId === administrator.id ||
                                  changingStatusId === administrator.id
                                }
                              >
                                {deletingId === administrator.id
                                  ? "Deleting..."
                                  : "Delete"}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="admin-readonly-label">
                          Protected account
                        </span>
                      )}
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

      {editingAdministrator && (
        <div
          className="admin-branch-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closeEditModal();
            }
          }}
        >
          <section
            className="admin-branch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-administrator-title"
          >
            <div className="admin-branch-modal-header">
              <div>
                <span className="admin-card-eyebrow">ACCOUNT DETAILS</span>
                <h2 id="edit-administrator-title">Edit Administrator</h2>
                <p>Update this administrator's contact information.</p>
              </div>

              <button
                type="button"
                className="admin-branch-close-button"
                onClick={closeEditModal}
                disabled={savingEdit}
                aria-label="Close edit form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleEditAdministrator}>
              <div className="admin-branch-form-grid">
                <div className="admin-form-field">
                  <label htmlFor="edit-admin-full-name">Full name</label>
                  <input
                    id="edit-admin-full-name"
                    type="text"
                    value={editForm.fullName}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        fullName: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-admin-email">Email address</label>
                  <input
                    id="edit-admin-email"
                    type="email"
                    value={editForm.email}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                    required
                  />
                </div>

                <div className="admin-form-field">
                  <label htmlFor="edit-admin-phone">Phone number</label>
                  <input
                    id="edit-admin-phone"
                    type="tel"
                    value={editForm.phone}
                    onChange={(event) =>
                      setEditForm((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="admin-branch-form-footer">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={closeEditModal}
                  disabled={savingEdit}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={savingEdit}
                >
                  {savingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdministratorsPage;
