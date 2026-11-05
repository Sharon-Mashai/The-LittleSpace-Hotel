import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { clearAuthenticatedUser } from "../features/auth/authSlice";
import { logoutUser } from "../services/auth";
import {
  getAdminPermissions,
  type AdminPermission,
} from "../services/adminPermissions";

function AdminLayout() {
  const user = useAppSelector((state) => state.auth.user);

  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const userId = user?.id;
  const userRole = user?.role;
  const isSuperAdmin = userRole === "super_admin";

  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [isLoadingPermissions, setIsLoadingPermissions] = useState(true);
  const [permissionError, setPermissionError] = useState("");

  useEffect(() => {
    if (!userId || (userRole !== "admin" && userRole !== "super_admin")) {
      navigate("/sign-in", { replace: true });
      return;
    }

    let isMounted = true;

    async function loadPermissions() {
      try {
        const assignedPermissions = await getAdminPermissions();

        if (isMounted) {
          setPermissions(assignedPermissions);
          setPermissionError("");
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

    void loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [navigate, userId, userRole]);

  function handleLogout() {
    logoutUser();
    dispatch(clearAuthenticatedUser());
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
          <span className="admin-brand-eyebrow">HOTEL MANAGEMENT</span>
          <h2>LittleSpace</h2>
          <p>{isSuperAdmin ? "Super Admin Portal" : "Admin Portal"}</p>
        </div>

        <div className="admin-navigation-heading">MENU</div>

        <nav className="admin-navigation">
          {hasPermission("dashboard.view") && (
            <NavLink
              to={isSuperAdmin ? "/super-admin/dashboard" : "/admin/dashboard"}
              className="admin-nav-link"
            >
              <span className="admin-nav-indicator">01</span>
              <span>Dashboard</span>
            </NavLink>
          )}

          {hasPermission("bookings.view") && (
            <NavLink to="/admin/bookings" className="admin-nav-link">
              <span className="admin-nav-indicator">02</span>
              <span>Bookings</span>
            </NavLink>
          )}

          {hasPermission("guests.view") && (
            <NavLink to="/admin/guests" className="admin-nav-link">
              <span className="admin-nav-indicator">03</span>
              <span>Guests</span>
            </NavLink>
          )}

          {hasPermission("branches.view") && (
            <NavLink to="/admin/branches" className="admin-nav-link">
              <span className="admin-nav-indicator">04</span>
              <span>Branches</span>
            </NavLink>
          )}

          {hasPermission("room_types.view") && (
            <NavLink to="/admin/room-types" className="admin-nav-link">
              <span className="admin-nav-indicator">05</span>
              <span>Room Types</span>
            </NavLink>
          )}

          {isSuperAdmin && (
            <NavLink
              to="/super-admin/administrators"
              className="admin-nav-link"
            >
              <span className="admin-nav-indicator">06</span>
              <span>Administrator Management</span>
            </NavLink>
          )}
        </nav>

        <div className="admin-sidebar-footer">
          <div className="admin-user-profile">
            <div className="admin-user-avatar" aria-hidden="true">
              {user.full_name.charAt(0).toUpperCase()}
            </div>

            <div className="admin-user-details">
              <p>{user.full_name}</p>
              <small>{isSuperAdmin ? "Super Admin" : "Admin"}</small>
            </div>
          </div>

          <button
            className="admin-sign-out-button"
            type="button"
            onClick={handleLogout}
          >
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
