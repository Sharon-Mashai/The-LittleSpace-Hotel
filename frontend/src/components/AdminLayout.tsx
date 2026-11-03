import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getLoggedInUser, logoutUser } from "../services/auth";
import {
  getAdminPermissions,
  type AdminPermission,
} from "../services/adminPermissions";

function AdminLayout() {
  const user = getLoggedInUser();
  const navigate = useNavigate();

  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    let isMounted = true;

    async function loadPermissions() {
      if (!user || (user.role !== "admin" && user.role !== "super_admin")) {
        navigate("/sign-in", { replace: true });
        return;
      }

      try {
        const assignedPermissions = await getAdminPermissions();

        if (isMounted) {
          setPermissions(assignedPermissions);
        }
      } catch (error) {
        if (isMounted) {
          setPermissionError(
            error instanceof Error
              ? error.message
              : "Unable to load administrator permissions.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoadingPermissions(false);
        }
      }
    }

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [navigate, user]);

  function handleLogout() {
    logoutUser();
    navigate("/sign-in", { replace: true });
  }

  function hasPermission(permission: AdminPermission): boolean {
    return isSuperAdmin || permissions.includes(permission);
  }

  if (!user) {
    return null;
  }

  if (isLoadingPermissions) {
    return (
      <div className="admin-layout-loading">
        Loading administrator portal...
      </div>
    );
  }

  if (permissionError) {
    return (
      <div className="admin-layout-error">
        <p>{permissionError}</p>
        <button type="button" onClick={handleLogout}>
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <h2>LittleSpace</h2>
          <p>{isSuperAdmin ? "Super Admin Portal" : "Admin Portal"}</p>
        </div>

        <nav className="admin-navigation">
          {hasPermission("dashboard.view") && (
            <NavLink
              to={isSuperAdmin ? "/super-admin/dashboard" : "/admin/dashboard"}
              className="admin-nav-link"
            >
              Dashboard
            </NavLink>
          )}

          {hasPermission("bookings.view") && (
            <NavLink to="/admin/bookings" className="admin-nav-link">
              Bookings
            </NavLink>
          )}

          {hasPermission("guests.view") && (
            <NavLink to="/admin/guests" className="admin-nav-link">
              Guests
            </NavLink>
          )}

          {hasPermission("branches.view") && (
            <NavLink to="/admin/branches" className="admin-nav-link">
              Branches
            </NavLink>
          )}

          {hasPermission("room_types.view") && (
            <NavLink to="/admin/room-types" className="admin-nav-link">
              Room Types
            </NavLink>
          )}

          {isSuperAdmin && (
            <NavLink
              to="/super-admin/administrators"
              className="admin-nav-link"
            >
              Administrator Management
            </NavLink>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <p>{user.full_name}</p>
          <small>{isSuperAdmin ? "Super Admin" : "Admin"}</small>

          <button type="button" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </aside>

      <main className="admin-main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
