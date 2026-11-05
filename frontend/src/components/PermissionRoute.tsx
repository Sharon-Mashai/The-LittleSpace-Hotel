import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAppSelector } from "../app/hooks";
import { getAdminPermissions, type AdminPermission,} from "../services/adminPermissions";

type PermissionRouteProps = {
  requiredPermission: AdminPermission;
};

function PermissionRoute({ requiredPermission }: PermissionRouteProps) {
  const user = useAppSelector((state) => state.auth.user);

  const userId = user?.id;
  const userRole = user?.role;

  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const isAdministrator = userRole === "admin" || userRole === "super_admin";

  useEffect(() => {
    if (!userId || !isAdministrator) {
      return;
    }

    let isMounted = true;

    async function checkPermission() {
      try {
        const permissions = await getAdminPermissions();

        if (isMounted) {
          setHasPermission(permissions.includes(requiredPermission));
        }
      } catch (err) {
        if (isMounted) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to verify your permissions.",
          );
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    checkPermission();

    return () => {
      isMounted = false;
    };
  }, [userId, isAdministrator, requiredPermission]);

  if (!user) {
    return <Navigate to="/sign-in" replace />;
  }

  if (!isAdministrator) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return <div className="admin-layout-loading">Checking permissions...</div>;
  }

  if (error) {
    return (
      <div className="admin-layout-error">
        <p>{error}</p>
      </div>
    );
  }

  if (!hasPermission) {
    return (
      <div className="admin-layout-error">
        <h2>Access Denied</h2>
        <p>You do not have permission to access this page.</p>
      </div>
    );
  }

  return <Outlet />;
}

export default PermissionRoute;
