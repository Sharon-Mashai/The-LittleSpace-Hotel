import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAuthToken } from "../../services/auth";
import { getAdminPermissions, type AdminPermission,} from "../../services/adminPermissions";
import ConfirmationModal from "../../components/ConfirmationModal";

type AdminBranch = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address_line: string;
  suburb: string | null;
  city: string;
  province: string | null;
  country: string;
  postal_code: string | null;
  latitude: number | null;
  longitude: number | null;
  star_rating: number | null;
  is_active: boolean;
  created_at: string;
};

type BranchesResponse = {
  success: boolean;
  count: number;
  data: AdminBranch[];
};

type BranchResponse = {
  success: boolean;
  message: string;
  data: AdminBranch;
};

type BranchFormData = {
  name: string;
  slug: string;
  description: string;
  addressLine: string;
  suburb: string;
  city: string;
  province: string;
  country: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  starRating: string;
};

const emptyForm: BranchFormData = {
  name: "",
  slug: "",
  description: "",
  addressLine: "",
  suburb: "",
  city: "",
  province: "",
  country: "South Africa",
  postalCode: "",
  latitude: "",
  longitude: "",
  starRating: "",
};

function AdminBranchesPage() {
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [formData, setFormData] = useState<BranchFormData>(emptyForm);
  const [editingBranchId, setEditingBranchId] = useState<number | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pendingBranchConfirmation, setPendingBranchConfirmation] =
    useState<AdminBranch | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canCreate = permissions.includes("branches.create");
  const canEdit = permissions.includes("branches.edit");

  useEffect(() => {
    let isMounted = true;

    async function loadPage() {
      const token = getAuthToken();

      if (!token) {
        if (isMounted) {
          setError("Your login session has expired. Please sign in again.");
          setIsLoading(false);
        }
        return;
      }

      try {
        const [branchResponse, userPermissions] = await Promise.all([
          apiRequest<BranchesResponse>("/admin/branches", {
            method: "GET",
            token,
          }),
          getAdminPermissions(),
        ]);

        if (isMounted) {
          setBranches(branchResponse.data);
          setPermissions(userPermissions);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load hotel branches.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    void loadPage();

    return () => {
      isMounted = false;
    };
  }, []);

  function handleInputChange(
    event: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) {
    const { name, value } = event.target;

    setFormData((previous) => ({
      ...previous,
      [name]: value,
    }));
  }

  function openCreateForm() {
    setEditingBranchId(null);
    setFormData(emptyForm);
    setMessage("");
    setError("");
    setIsFormOpen(true);
  }

  function openEditForm(branch: AdminBranch) {
    setEditingBranchId(branch.id);

    setFormData({
      name: branch.name,
      slug: branch.slug,
      description: branch.description ?? "",
      addressLine: branch.address_line,
      suburb: branch.suburb ?? "",
      city: branch.city,
      province: branch.province ?? "",
      country: branch.country,
      postalCode: branch.postal_code ?? "",
      latitude: branch.latitude?.toString() ?? "",
      longitude: branch.longitude?.toString() ?? "",
      starRating: branch.star_rating?.toString() ?? "",
    });

    setMessage("");
    setError("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingBranchId(null);
    setFormData(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAuthToken();

    if (!token) {
      setError("Your login session has expired. Please sign in again.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    const payload = {
      name: formData.name.trim(),
      slug: formData.slug.trim(),
      description: formData.description.trim() || null,
      addressLine: formData.addressLine.trim(),
      suburb: formData.suburb.trim() || null,
      city: formData.city.trim(),
      province: formData.province.trim() || null,
      country: formData.country.trim(),
      postalCode: formData.postalCode.trim() || null,
      latitude:
        formData.latitude.trim() === "" ? null : Number(formData.latitude),
      longitude:
        formData.longitude.trim() === "" ? null : Number(formData.longitude),
      starRating:
        formData.starRating.trim() === "" ? null : Number(formData.starRating),
    };

    try {
      let response: BranchResponse;

      if (editingBranchId !== null) {
        response = await apiRequest<BranchResponse>(
          `/admin/branches/${editingBranchId}`,
          {
            method: "PATCH",
            token,
            body: {
              ...payload,
              isActive: branches.find((branch) => branch.id === editingBranchId)
                ?.is_active,
            },
          },
        );

        setBranches((previous) =>
          previous.map((branch) =>
            branch.id === editingBranchId ? response.data : branch,
          ),
        );

        setMessage("Branch details updated successfully.");
      } else {
        response = await apiRequest<BranchResponse>("/admin/branches", {
          method: "POST",
          token,
          body: payload,
        });

        setBranches((previous) => [...previous, response.data]);

        setMessage("New branch created successfully.");
      }

      closeForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save branch details.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleBranchStatus(branch: AdminBranch) {
    const token = getAuthToken();

    if (!token) {
      setError("Your login session has expired. Please sign in again.");
      return;
    }

    const newStatus = !branch.is_active;

    setError("");
    setMessage("");

    try {
      const response = await apiRequest<BranchResponse>(
        `/admin/branches/${branch.id}`,
        {
          method: "PATCH",
          token,
          body: { isActive: newStatus },
        },
      );

      setBranches((previous) =>
        previous.map((item) => (item.id === branch.id ? response.data : item)),
      );

      setMessage(
        `${branch.name} has been ${
          newStatus ? "activated" : "deactivated"
        } successfully.`,
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update branch status.",
      );
    }
  }

  if (isLoading) {
    return (
      <div className="admin-page">
        <p>Loading hotel branches...</p>
      </div>
    );
  }

  if (error && branches.length === 0) {
    return (
      <div className="admin-page">
        <h1>Hotel Branches</h1>
        <p className="admin-message admin-message-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-branches-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">LITTLESPACE HOTEL</p>
          <h1>Hotel Branches</h1>
          <p>Manage the locations that make up the LittleSpace Hotel.</p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="admin-primary-button"
            onClick={openCreateForm}
          >
            + Add New Branch
          </button>
        )}
      </div>

      {message && (
        <p className="admin-message admin-message-success" role="status">
          {message}
        </p>
      )}

      {error && (
        <p className="admin-message admin-message-error" role="alert">
          {error}
        </p>
      )}

      <div className="admin-branches-summary">
        <div>
          <strong>{branches.length}</strong>
          <span>Total branches</span>
        </div>
        <div>
          <strong>
            {branches.filter((branch) => branch.is_active).length}
          </strong>
          <span>Active branches</span>
        </div>
        <div>
          <strong>
            {branches.filter((branch) => !branch.is_active).length}
          </strong>
          <span>Inactive branches</span>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="admin-empty-state">
          <h2>No branches found</h2>
          <p>Hotel branch records will appear here.</p>
        </div>
      ) : (
        <div className="admin-branches-grid">
          {branches.map((branch) => (
            <article className="admin-branch-card" key={branch.id}>
              <div className="admin-branch-card-header">
                <div>
                  <p className="admin-page-eyebrow">HOTEL LOCATION</p>
                  <h2>{branch.name}</h2>
                </div>

                <span
                  className={`admin-account-status ${
                    branch.is_active ? "active" : "inactive"
                  }`}
                >
                  <span className="admin-status-dot" />
                  {branch.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              {branch.description && <p>{branch.description}</p>}

              <div className="admin-branch-address">
                <span>{branch.address_line}</span>
                {branch.suburb && <span>{branch.suburb}</span>}
                <span>
                  {[branch.city, branch.province, branch.postal_code]
                    .filter(Boolean)
                    .join(", ")}
                </span>
                <span>{branch.country}</span>
              </div>

              <div className="admin-branch-meta">
                <span>
                  {branch.star_rating
                    ? `${branch.star_rating} star rating`
                    : "No star rating"}
                </span>
                <span>/{branch.slug}</span>
              </div>

              {canEdit && (
                <div className="admin-branch-actions">
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => openEditForm(branch)}
                  >
                    Edit details
                  </button>

                  <button
                    type="button"
                    className={`admin-branch-status-button ${
                      branch.is_active ? "deactivate" : "activate"
                    }`}
                    onClick={() => setPendingBranchConfirmation(branch)}
                  >
                    {branch.is_active ? "Deactivate" : "Activate"}
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}

      {isFormOpen && (
        <div className="admin-branch-modal-backdrop">
          <section
            className="admin-branch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="branch-form-title"
          >
            <div className="admin-branch-modal-header">
              <div>
                <p className="admin-page-eyebrow">LITTLESPACE HOTEL</p>
                <h2 id="branch-form-title">
                  {editingBranchId !== null ? "Edit Branch" : "Add New Branch"}
                </h2>
              </div>

              <button
                type="button"
                className="admin-branch-close-button"
                onClick={closeForm}
                aria-label="Close form"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="admin-branch-form-grid">
                <label>
                  Branch name *
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  URL slug *
                  <input
                    name="slug"
                    value={formData.slug}
                    onChange={handleInputChange}
                    placeholder="e.g. johannesburg"
                    required
                  />
                </label>

                <label className="full-width">
                  Description
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                  />
                </label>

                <label className="full-width">
                  Street address *
                  <input
                    name="addressLine"
                    value={formData.addressLine}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Suburb
                  <input
                    name="suburb"
                    value={formData.suburb}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  City *
                  <input
                    name="city"
                    value={formData.city}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Province
                  <input
                    name="province"
                    value={formData.province}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Country *
                  <input
                    name="country"
                    value={formData.country}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Postal code
                  <input
                    name="postalCode"
                    value={formData.postalCode}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Star rating
                  <select
                    name="starRating"
                    value={formData.starRating}
                    onChange={handleInputChange}
                  >
                    <option value="">Not specified</option>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <option key={rating} value={rating}>
                        {rating} stars
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Latitude
                  <input
                    type="number"
                    step="any"
                    name="latitude"
                    value={formData.latitude}
                    onChange={handleInputChange}
                  />
                </label>

                <label>
                  Longitude
                  <input
                    type="number"
                    step="any"
                    name="longitude"
                    value={formData.longitude}
                    onChange={handleInputChange}
                  />
                </label>
              </div>

              <div className="admin-branch-form-footer">
                <button
                  type="button"
                  className="admin-secondary-button"
                  onClick={closeForm}
                  disabled={isSaving}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-primary-button"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Saving..."
                    : editingBranchId !== null
                      ? "Save Changes"
                      : "Create Branch"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      {pendingBranchConfirmation && (
        <ConfirmationModal
          title={`Are you sure you want to ${
            pendingBranchConfirmation.is_active ? "deactivate" : "activate"
          } this branch?`}
          message={`${pendingBranchConfirmation.name} will be ${
            pendingBranchConfirmation.is_active ? "deactivated" : "activated"
          }.`}
          confirmText={
            pendingBranchConfirmation.is_active ? "Deactivate" : "Activate"
          }
          icon={pendingBranchConfirmation.is_active ? "!" : "✓"}
          variant={pendingBranchConfirmation.is_active ? "danger" : "confirm"}
          onCancel={() => setPendingBranchConfirmation(null)}
          onConfirm={() => {
            const branch = pendingBranchConfirmation;
            setPendingBranchConfirmation(null);
            void toggleBranchStatus(branch);
          }}
        />
      )}
    </div>
  );
}

export default AdminBranchesPage;
