import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getLoggedInUser } from "../../services/auth";
import {
  getAdminPermissions,
  type AdminPermission,
} from "../../services/adminPermissions";

function AdminDashboardPage() {
  const user = getLoggedInUser();
  const userId = user?.id;
  const userRole = user?.role;

  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const isSuperAdmin = userRole === "super_admin";
  const isAdministrator = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    if (!isAdministrator || !userId) {
      return;
    }

    let isMounted = true;

    async function loadPermissions() {
      try {
        const assignedPermissions = await getAdminPermissions();

        if (isMounted) {
          setPermissions(assignedPermissions);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load dashboard permissions.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadPermissions();

    return () => {
      isMounted = false;
    };
  }, [isAdministrator, userId]);

  function hasPermission(permission: AdminPermission): boolean {
    return isSuperAdmin || permissions.includes(permission);
  }

  if (!isAdministrator) {
    return (
      <div className="admin-dashboard">
        <p>You must be logged in as an administrator.</p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="admin-dashboard">Loading dashboard...</div>;
  }

  if (error) {
    return (
      <div className="admin-dashboard">
        <p>{error}</p>
      </div>
    );
  }

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
        {hasPermission("bookings.view") && (
          <Link to="/admin/bookings" className="admin-dashboard-card">
            <h2>Bookings</h2>
            <p>View and manage guest bookings.</p>
          </Link>
        )}

        {hasPermission("guests.view") && (
          <Link to="/admin/guests" className="admin-dashboard-card">
            <h2>Guests</h2>
            <p>View guest records and information.</p>
          </Link>
        )}

        {hasPermission("branches.view") && (
          <Link to="/admin/branches" className="admin-dashboard-card">
            <h2>Branches</h2>
            <p>Manage LittleSpace Hotel branches.</p>
          </Link>
        )}

        {hasPermission("room_types.view") && (
          <Link to="/admin/room-types" className="admin-dashboard-card">
            <h2>Room Types</h2>
            <p>Manage available room types.</p>
          </Link>
        )}
      </div>
    </div>
  );
}

export default AdminDashboardPage;
