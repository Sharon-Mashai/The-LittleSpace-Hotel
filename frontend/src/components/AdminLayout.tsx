import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { getLoggedInUser, logoutUser } from "../services/auth";

function AdminLayout() {
  const user = getLoggedInUser();
  const navigate = useNavigate();

  function handleLogout() {
    logoutUser();
    navigate("/sign-in", { replace: true });
  }

  const isSuperAdmin = user?.role === "super_admin";

  return (
    <div className="admin-layout">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-brand">
          <h2>LittleSpace</h2>
          <p>{isSuperAdmin ? "Super Admin Portal" : "Admin Portal"}</p>
        </div>

        <nav className="admin-navigation">
          <NavLink
            to={isSuperAdmin ? "/super-admin/dashboard" : "/admin/dashboard"}
            className="admin-nav-link"
          >
            Dashboard
          </NavLink>

          <NavLink to="/admin/bookings" className="admin-nav-link">
            Bookings
          </NavLink>

          <NavLink to="/admin/guests" className="admin-nav-link">
            Guests
          </NavLink>

          <NavLink to="/admin/branches" className="admin-nav-link">
            Branches
          </NavLink>

          <NavLink to="/admin/room-types" className="admin-nav-link">
            Room Types
          </NavLink>

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
          <p>{user?.full_name}</p>
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
