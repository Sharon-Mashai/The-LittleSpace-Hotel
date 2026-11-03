import { Link } from "react-router-dom";
import { getLoggedInUser } from "../../services/auth";

function SuperAdminDashboardPage() {
  const user = getLoggedInUser();

  return (
    <div className="super-admin-dashboard">
      <div className="super-admin-dashboard-heading">
        <div>
          <span className="admin-page-eyebrow">LITTLESPACE ADMINISTRATION</span>
          <h1>Super Admin Dashboard</h1>
          <p>
            Welcome back, {user?.full_name ?? "Super Admin"}. Manage LittleSpace
            Hotel administration from here.
          </p>
        </div>

        <span className="super-admin-welcome-label">Super Admin</span>
      </div>

      <div className="super-admin-dashboard-cards">
        <Link
          to="/super-admin/administrators"
          className="super-admin-dashboard-card"
        >
          <div className="super-admin-card-icon">
            <span>01</span>
          </div>

          <div className="super-admin-card-content">
            <span className="super-admin-card-eyebrow">ACCOUNT MANAGEMENT</span>
            <h2>Administrator Management</h2>
            <p>Create, view and manage administrator accounts.</p>
          </div>

          <span className="super-admin-card-arrow" aria-hidden="true">
            →
          </span>
        </Link>

        <Link to="/admin/dashboard" className="super-admin-dashboard-card">
          <div className="super-admin-card-icon">
            <span>02</span>
          </div>

          <div className="super-admin-card-content">
            <span className="super-admin-card-eyebrow">HOTEL MANAGEMENT</span>
            <h2>Hotel Operations</h2>
            <p>Access bookings, guests, branches and room types.</p>
          </div>

          <span className="super-admin-card-arrow" aria-hidden="true">
            →
          </span>
        </Link>
      </div>

      <div className="super-admin-dashboard-note">
        <div className="super-admin-note-mark">i</div>
        <p>
          As Super Admin, you have access to administrator management and all
          hotel operations.
        </p>
      </div>
    </div>
  );
}

export default SuperAdminDashboardPage;
