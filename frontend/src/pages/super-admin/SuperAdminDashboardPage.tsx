import { Link } from "react-router-dom";
import { getLoggedInUser } from "../../services/auth";

function SuperAdminDashboardPage() {
  const user = getLoggedInUser();

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h1>Super Admin Dashboard</h1>
        <p>
          Welcome back, {user?.full_name ?? "Super Admin"}. Manage LittleSpace
          Hotel administration from here.
        </p>
      </div>

      <div className="admin-dashboard-cards">
        <Link to="/super-admin/administrators" className="admin-dashboard-card">
          <h2>Administrator Management</h2>
          <p>Create, view and manage administrator accounts.</p>
        </Link>

        <Link to="/admin/dashboard" className="admin-dashboard-card">
          <h2>Hotel Operations</h2>
          <p>Access bookings, guests, branches and room types.</p>
        </Link>
      </div>
    </div>
  );
}

export default SuperAdminDashboardPage;
