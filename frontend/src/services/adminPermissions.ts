import { apiRequest } from "./api";
import { getAuthToken, getLoggedInUser } from "./auth";

export type AdminPermission =
  | "dashboard.view"
  | "bookings.view"
  | "bookings.cancel"
  | "bookings.reject"
  | "guests.view"
  | "branches.view"
  | "branches.create"
  | "branches.edit"
  | "room_types.view"
  | "room_types.create"
  | "room_types.edit";

type AdminPermissionsResponse = {
  success: boolean;
  data: {
    userId: string;
    role: "admin" | "super_admin";
    permissions: AdminPermission[];
  };
};

// Retrieve permissions for the currently logged-in administrator.
export async function getAdminPermissions(): Promise<AdminPermission[]> {
  const user = getLoggedInUser();
  const token = getAuthToken();

  if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
    throw new Error("An administrator must be logged in.");
  }

  if (!token) {
    throw new Error("Your authentication session has expired.");
  }

  // Super Admins have unrestricted access.
  if (user.role === "super_admin") {
    return [
      "dashboard.view",
      "bookings.view",
      "bookings.cancel",
      "bookings.reject",
      "guests.view",
      "branches.view",
      "branches.create",
      "branches.edit",
      "room_types.view",
      "room_types.create",
      "room_types.edit",
    ];
  }

  const response = await apiRequest<AdminPermissionsResponse>(
    "/admin/administrators/me/permissions",
    {
      method: "GET",
      token,
    },
  );

  return response.data.permissions;
}
