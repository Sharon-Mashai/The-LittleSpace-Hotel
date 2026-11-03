import { Navigate, Outlet } from "react-router-dom";
import { getLoggedInUser, type UserRole } from "../services/auth";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
};

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const user = getLoggedInUser();

  // No authenticated user: return to sign-in.
  if (!user) {
    return <Navigate to="/home" replace />;
  }

  // Authenticated, but the user's role is not permitted.
  if (!allowedRoles.includes(user.role)) {
    if (user.role === "guest") {
      return <Navigate to="/" replace />;
    }

    if (user.role === "admin") {
      return <Navigate to="/admin/dashboard" replace />;
    }

    if (user.role === "super_admin") {
      return <Navigate to="/super-admin/dashboard" replace />;
    }
  }

  // The user has permission to access this route.
  return <Outlet />;
}

export default ProtectedRoute;
