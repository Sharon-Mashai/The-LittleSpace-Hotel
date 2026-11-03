import { Link } from "react-router-dom";
import { getLoggedInUser } from "../../services/auth";

function AdminDashboardPage() {
  const user = getLoggedInUser();

  return (
    <div className="admin-dashboard">
      <div className="admin-dashboard-header">
        <h1>Admin Dashboard</h1>
        <p>
          Welcome back, {user?.full_name ?? "Admin"}. Manage LittleSpace Hotel
          operations from here.
        </p>
      </div>

      <div className="admin-dashboard-cards">
        <Link to="/admin/bookings" className="admin-dashboard-card">
          <h2>Bookings</h2>
          <p>View and manage guest bookings.</p>
        </Link>

        <Link to="/admin/guests" className="admin-dashboard-card">
          <h2>Guests</h2>
          <p>View guest records and information.</p>
        </Link>

        <Link to="/admin/branches" className="admin-dashboard-card">
          <h2>Branches</h2>
          <p>Manage LittleSpace Hotel branches.</p>
        </Link>

        <Link to="/admin/room-types" className="admin-dashboard-card">
          <h2>Room Types</h2>
          <p>Manage available room types.</p>
        </Link>
      </div>
    </div>
  );
}

export default AdminDashboardPage;
