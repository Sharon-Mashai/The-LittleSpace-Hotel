export const ADMIN_PERMISSIONS = [
  {
    key: "dashboard.view",
    label: "View Dashboard",
    module: "Dashboard",
  },
  {
    key: "bookings.view",
    label: "View Bookings",
    module: "Bookings",
  },
  {
    key: "bookings.cancel",
    label: "Cancel Bookings",
    module: "Bookings",
  },
  {
    key: "bookings.reject",
    label: "Reject Bookings",
    module: "Bookings",
  },
  {
    key: "guests.view",
    label: "View Guests",
    module: "Guests",
  },
  {
    key: "branches.view",
    label: "View Branches",
    module: "Branches",
  },
  {
    key: "branches.create",
    label: "Create Branches",
    module: "Branches",
  },
  {
    key: "branches.edit",
    label: "Edit Branches",
    module: "Branches",
  },
  {
    key: "room_types.view",
    label: "View Room Types",
    module: "Room Types",
  },
  {
    key: "room_types.create",
    label: "Create Room Types",
    module: "Room Types",
  },
  {
    key: "room_types.edit",
    label: "Edit Room Types",
    module: "Room Types",
  },
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]["key"];
