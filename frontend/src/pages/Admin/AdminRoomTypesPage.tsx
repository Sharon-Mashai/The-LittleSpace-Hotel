import { useEffect, useState } from "react";
import { apiRequest } from "../../services/api";
import { getAuthToken } from "../../services/auth";
import { getAdminPermissions, type AdminPermission,} from "../../services/adminPermissions";

type AdminBranch = {
  id: number;
  name: string;
  city: string;
};

type AdminRoomType = {
  id: number;
  branch_id: number;
  branch_name: string;
  branch_city: string;
  name: string;
  description: string | null;
  capacity_adults: number;
  capacity_children: number;
  base_price: string | number;
  currency: string;
  facilities: string[] | string;
  policies: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type RoomTypesResponse = {
  success: boolean;
  count: number;
  data: AdminRoomType[];
};

type BranchesResponse = {
  success: boolean;
  count: number;
  data: AdminBranch[];
};

type RoomTypeResponse = {
  success: boolean;
  message: string;
  data: AdminRoomType;
};

type RoomTypeFormData = {
  branchId: string;
  name: string;
  description: string;
  capacityAdults: string;
  capacityChildren: string;
  basePrice: string;
  currency: string;
  facilities: string;
  policies: string;
};

const emptyForm: RoomTypeFormData = {
  branchId: "",
  name: "",
  description: "",
  capacityAdults: "2",
  capacityChildren: "0",
  basePrice: "",
  currency: "ZAR",
  facilities: "",
  policies: "",
};

function getFacilities(value: AdminRoomType["facilities"]): string[] {
  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter(
          (item): item is string => typeof item === "string",
        );
      }
    } catch {
      return [];
    }
  }

  return [];
}

function formatPrice(price: string | number, currency: string): string {
  const amount = Number(price);

  if (!Number.isFinite(amount)) {
    return `${currency} ${price}`;
  }

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(amount);
}

function AdminRoomTypesPage() {
  const [roomTypes, setRoomTypes] = useState<AdminRoomType[]>([]);
  const [branches, setBranches] = useState<AdminBranch[]>([]);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [formData, setFormData] = useState<RoomTypeFormData>(emptyForm);
  const [editingRoomTypeId, setEditingRoomTypeId] = useState<number | null>(
    null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canCreate = permissions.includes("room_types.create");
  const canEdit = permissions.includes("room_types.edit");

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
        const [roomTypesResponse, branchesResponse, userPermissions] =
          await Promise.all([
            apiRequest<RoomTypesResponse>("/admin/room-types", {
              method: "GET",
              token,
            }),
            apiRequest<BranchesResponse>("/admin/branches", {
              method: "GET",
              token,
            }),
            getAdminPermissions(),
          ]);

        if (isMounted) {
          setRoomTypes(roomTypesResponse.data);
          setBranches(branchesResponse.data);
          setPermissions(userPermissions);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error ? err.message : "Unable to load room types.",
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
    setEditingRoomTypeId(null);
    setFormData({
      ...emptyForm,
      branchId: branches[0] ? String(branches[0].id) : "",
    });
    setError("");
    setMessage("");
    setIsFormOpen(true);
  }

  function openEditForm(roomType: AdminRoomType) {
    setEditingRoomTypeId(roomType.id);

    setFormData({
      branchId: String(roomType.branch_id),
      name: roomType.name,
      description: roomType.description ?? "",
      capacityAdults: String(roomType.capacity_adults),
      capacityChildren: String(roomType.capacity_children),
      basePrice: String(roomType.base_price),
      currency: roomType.currency,
      facilities: getFacilities(roomType.facilities).join("\n"),
      policies: roomType.policies ?? "",
    });

    setError("");
    setMessage("");
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingRoomTypeId(null);
    setFormData(emptyForm);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = getAuthToken();

    if (!token) {
      setError("Your login session has expired. Please sign in again.");
      return;
    }

    const branchId = Number(formData.branchId);
    const capacityAdults = Number(formData.capacityAdults);
    const capacityChildren = Number(formData.capacityChildren);
    const basePrice = Number(formData.basePrice);

    if (!Number.isSafeInteger(branchId) || branchId <= 0) {
      setError("Please select a valid hotel branch.");
      return;
    }

    if (!Number.isSafeInteger(capacityAdults) || capacityAdults <= 0) {
      setError("Adult capacity must be a whole number greater than zero.");
      return;
    }

    if (!Number.isSafeInteger(capacityChildren) || capacityChildren < 0) {
      setError("Child capacity must be zero or a positive whole number.");
      return;
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      setError("Please enter a valid room price.");
      return;
    }

    const facilities = formData.facilities
      .split("\n")
      .map((facility) => facility.trim())
      .filter(Boolean);

    const payload = {
      branchId,
      name: formData.name.trim(),
      description: formData.description.trim() || null,
      capacityAdults,
      capacityChildren,
      basePrice,
      currency: formData.currency.trim().toUpperCase(),
      facilities,
      policies: formData.policies.trim() || null,
    };

    if (!payload.name) {
      setError("Room type name is required.");
      return;
    }

    if (!/^[A-Z]{3}$/.test(payload.currency)) {
      setError("Currency must be a three-letter uppercase code.");
      return;
    }

    setIsSaving(true);
    setError("");
    setMessage("");

    try {
      if (editingRoomTypeId !== null) {
        const response = await apiRequest<RoomTypeResponse>(
          `/admin/room-types/${editingRoomTypeId}`,
          {
            method: "PATCH",
            token,
            body: payload,
          },
        );

        const selectedBranch = branches.find(
          (branch) => branch.id === response.data.branch_id,
        );

        const updatedRoomType: AdminRoomType = {
          ...response.data,
          branch_name:
            response.data.branch_name ??
            selectedBranch?.name ??
            "Unknown branch",
          branch_city: response.data.branch_city ?? selectedBranch?.city ?? "",
        };

        setRoomTypes((previous) =>
          previous.map((roomType) =>
            roomType.id === editingRoomTypeId ? updatedRoomType : roomType,
          ),
        );

        setMessage("Room type updated successfully.");
      } else {
        const response = await apiRequest<RoomTypeResponse>(
          "/admin/room-types",
          {
            method: "POST",
            token,
            body: payload,
          },
        );

        const selectedBranch = branches.find(
          (branch) => branch.id === response.data.branch_id,
        );

        const newRoomType: AdminRoomType = {
          ...response.data,
          branch_name:
            response.data.branch_name ??
            selectedBranch?.name ??
            "Unknown branch",
          branch_city: response.data.branch_city ?? selectedBranch?.city ?? "",
        };

        setRoomTypes((previous) => [...previous, newRoomType]);

        setMessage("Room type created successfully.");
      }

      closeForm();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save room type.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleRoomTypeStatus(roomType: AdminRoomType) {
    const token = getAuthToken();

    if (!token) {
      setError("Your login session has expired. Please sign in again.");
      return;
    }

    const newStatus = !roomType.is_active;

    const confirmed = window.confirm(
      `Are you sure you want to ${
        newStatus ? "activate" : "deactivate"
      } ${roomType.name}?`,
    );

    if (!confirmed) return;

    setError("");
    setMessage("");

    try {
      const response = await apiRequest<RoomTypeResponse>(
        `/admin/room-types/${roomType.id}`,
        {
          method: "PATCH",
          token,
          body: { isActive: newStatus },
        },
      );

      setRoomTypes((previous) =>
        previous.map((item) =>
          item.id === roomType.id
            ? { ...item, is_active: response.data.is_active }
            : item,
        ),
      );

      setMessage(
        `${roomType.name} has been ${
          newStatus ? "activated" : "deactivated"
        } successfully.`,
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update room type status.",
      );
    }
  }

  const filteredRoomTypes = roomTypes.filter((roomType) => {
    const searchTerm = search.trim().toLowerCase();

    return (
      roomType.name.toLowerCase().includes(searchTerm) ||
      roomType.branch_name.toLowerCase().includes(searchTerm) ||
      roomType.branch_city.toLowerCase().includes(searchTerm)
    );
  });

  if (isLoading) {
    return (
      <div className="admin-page">
        <p>Loading room types...</p>
      </div>
    );
  }

  if (error && roomTypes.length === 0) {
    return (
      <div className="admin-page">
        <h1>Room Types</h1>
        <p className="admin-message admin-message-error" role="alert">
          {error}
        </p>
      </div>
    );
  }

  return (
    <div className="admin-page admin-room-types-page">
      <div className="admin-page-header">
        <div>
          <p className="admin-page-eyebrow">LITTLESPACE HOTEL</p>
          <h1>Room Types</h1>
          <p>Manage accommodation types across your hotel branches.</p>
        </div>

        {canCreate && (
          <button
            type="button"
            className="admin-primary-button"
            onClick={openCreateForm}
            disabled={branches.length === 0}
          >
            + Add Room Type
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

      <div className="admin-room-types-summary">
        <div>
          <strong>{roomTypes.length}</strong>
          <span>Total room types</span>
        </div>
        <div>
          <strong>
            {roomTypes.filter((roomType) => roomType.is_active).length}
          </strong>
          <span>Active room types</span>
        </div>
        <div>
          <strong>
            {roomTypes.filter((roomType) => !roomType.is_active).length}
          </strong>
          <span>Inactive room types</span>
        </div>
      </div>

      <section className="admin-room-types-section">
        <div className="admin-room-types-toolbar">
          <div>
            <h2>Accommodation Directory</h2>
            <p>Room types registered across LittleSpace branches.</p>
          </div>

          <input
            type="search"
            className="admin-room-types-search"
            placeholder="Search room types..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search room types by name or branch"
          />
        </div>

        {filteredRoomTypes.length === 0 ? (
          <div className="admin-empty-state">
            <h2>{search ? "No matching room types" : "No room types found"}</h2>
            <p>
              {search
                ? "Try another room type name or branch."
                : "Room types will appear here once they have been added."}
            </p>
          </div>
        ) : (
          <div className="admin-room-types-grid">
            {filteredRoomTypes.map((roomType) => (
              <article className="admin-room-type-card" key={roomType.id}>
                <div className="admin-room-type-card-header">
                  <div>
                    <p className="admin-page-eyebrow">{roomType.branch_name}</p>
                    <h3>{roomType.name}</h3>
                    <span className="admin-room-type-location">
                      {roomType.branch_city}
                    </span>
                  </div>

                  <span
                    className={`admin-account-status ${
                      roomType.is_active ? "active" : "inactive"
                    }`}
                  >
                    <span className="admin-status-dot" />
                    {roomType.is_active ? "Active" : "Inactive"}
                  </span>
                </div>

                {roomType.description && (
                  <p className="admin-room-type-description">
                    {roomType.description}
                  </p>
                )}

                <div className="admin-room-type-capacity">
                  <span>{roomType.capacity_adults} adults</span>
                  <span>{roomType.capacity_children} children</span>
                </div>

                <div className="admin-room-type-price">
                  <strong>
                    {formatPrice(roomType.base_price, roomType.currency)}
                  </strong>
                  <span>Base price per night</span>
                </div>

                {getFacilities(roomType.facilities).length > 0 && (
                  <div className="admin-room-type-facilities">
                    <h4>Facilities</h4>
                    <div>
                      {getFacilities(roomType.facilities).map(
                        (facility, index) => (
                          <span key={`${facility}-${index}`}>{facility}</span>
                        ),
                      )}
                    </div>
                  </div>
                )}

                {roomType.policies && (
                  <div className="admin-room-type-policies">
                    <h4>Policies</h4>
                    <p>{roomType.policies}</p>
                  </div>
                )}

                {canEdit && (
                  <div className="admin-room-type-actions">
                    <button
                      type="button"
                      className="admin-secondary-button"
                      onClick={() => openEditForm(roomType)}
                    >
                      Edit details
                    </button>

                    <button
                      type="button"
                      className={`admin-branch-status-button ${
                        roomType.is_active ? "deactivate" : "activate"
                      }`}
                      onClick={() => void toggleRoomTypeStatus(roomType)}
                    >
                      {roomType.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        )}

        <div className="admin-room-types-footer">
          Showing {filteredRoomTypes.length} of {roomTypes.length} room types
        </div>
      </section>

      {isFormOpen && (
        <div className="admin-branch-modal-backdrop">
          <section
            className="admin-branch-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-type-form-title"
          >
            <div className="admin-branch-modal-header">
              <div>
                <p className="admin-page-eyebrow">LITTLESPACE HOTEL</p>
                <h2 id="room-type-form-title">
                  {editingRoomTypeId !== null
                    ? "Edit Room Type"
                    : "Add Room Type"}
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
                <label className="full-width">
                  Hotel branch *
                  <select
                    name="branchId"
                    value={formData.branchId}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">Select a branch</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name} — {branch.city}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="full-width">
                  Room type name *
                  <input
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Deluxe Room"
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

                <label>
                  Adult capacity *
                  <input
                    type="number"
                    min="1"
                    step="1"
                    name="capacityAdults"
                    value={formData.capacityAdults}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Child capacity *
                  <input
                    type="number"
                    min="0"
                    step="1"
                    name="capacityChildren"
                    value={formData.capacityChildren}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Base price per night *
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    name="basePrice"
                    value={formData.basePrice}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label>
                  Currency *
                  <input
                    name="currency"
                    maxLength={3}
                    value={formData.currency}
                    onChange={handleInputChange}
                    required
                  />
                </label>

                <label className="full-width">
                  Facilities
                  <textarea
                    name="facilities"
                    value={formData.facilities}
                    onChange={handleInputChange}
                    rows={4}
                    placeholder={"Wi-Fi\nAir conditioning\nTelevision"}
                  />
                  <span className="admin-room-type-hint">
                    Enter one facility per line.
                  </span>
                </label>

                <label className="full-width">
                  Policies
                  <textarea
                    name="policies"
                    value={formData.policies}
                    onChange={handleInputChange}
                    rows={3}
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
                    : editingRoomTypeId !== null
                      ? "Save Changes"
                      : "Create Room Type"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default AdminRoomTypesPage;
