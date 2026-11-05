import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import type { UserRole } from "../services/auth";

type ProtectedRouteProps = {
  allowedRoles: UserRole[];
};

function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  // Get the authenticated user from Redux.
  const user = useAppSelector((state) => state.auth.user);

  // No authenticated user, return to sign-in.
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
